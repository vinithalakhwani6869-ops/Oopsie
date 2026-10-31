import 'dotenv/config';
import { db, isDbConfigured } from '../supabase.js';
import { generateQuestion, generateLesson } from '../llm.js';
import { FALLBACK_QUESTIONS } from '../seed/fallbackQuestions.js';
import { resourcesFor } from '../seed/resources.js';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const args = process.argv.slice(2);

function flag(name) {
  return args.includes(`--${name}`);
}
function value(name) {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.split('=').slice(1).join('=');
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

const onlyTopic = value('topic');
const onlyDifficulty = value('difficulty');
const force = flag('force');
const fallbackOnly = flag('fallback-only');
const withLessons = flag('lessons');
const perDifficulty = Number.parseInt(value('count') || '1', 10) || 1;

async function insertQuestion(topicId, difficulty, question, source = 'generated') {
  const { error } = await db()
    .from('questions')
    .insert({
      topic_id: topicId,
      difficulty,
      type: question.type,
      prompt: question.prompt,
      options: question.options ?? null,
      answer_key: question.answer_key,
      rubric: question.rubric,
      solution: question.solution,
      flaw: question.flaw ?? null,
      source,
      concept_tag: question.concept_tag ?? null,
    });
  if (error) throw new Error(error.message);
}

async function existingCount(topicId, difficulty) {
  const { count, error } = await db()
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topicId)
    .eq('difficulty', difficulty);
  if (error) throw new Error(error.message);
  return count || 0;
}

async function main() {
  if (!isDbConfigured) {
    console.error('\nMissing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env.\n');
    process.exit(1);
  }

  const { data: topics, error } = await db().from('topics').select('*').order('sort_order');
  if (error) {
    console.error('Could not load topics:', error.message);
    process.exit(1);
  }
  if (!topics?.length) {
    console.error('\nNo topics found. Run supabase/migrations/001_init.sql first.\n');
    process.exit(1);
  }

  const selected = topics.filter((topic) => !onlyTopic || topic.slug === onlyTopic);
  const difficulties = DIFFICULTIES.filter((difficulty) => !onlyDifficulty || difficulty === onlyDifficulty);

  console.log(`\nSeeding ${selected.length} topic(s) × ${difficulties.length} difficulty level(s).`);
  console.log(`LLM: ${process.env.LLM_MODEL || 'gpt-4o-mini'} · fallback only: ${fallbackOnly ? 'yes' : 'no'}\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const topic of selected) {
    console.log(`• ${topic.name}`);
    for (const difficulty of difficulties) {
      const count = await existingCount(topic.id, difficulty);
      if (count > 0 && !force) {
        console.log(`  – ${difficulty}: ${count} already seeded (skip)`);
        skipped += count;
        continue;
      }

      if (fallbackOnly) continue;

      const { data: recent } = await db()
        .from('questions')
        .select('prompt')
        .eq('topic_id', topic.id)
        .eq('difficulty', difficulty)
        .order('created_at', { ascending: false })
        .limit(5);

      const avoid = (recent || []).map((row) => row.prompt);
      for (let index = 0; index < perDifficulty; index += 1) {
        try {
          const question = await generateQuestion({
            topicName: topic.name,
            topicDescription: topic.description,
            difficulty,
            avoid,
          });
          await insertQuestion(topic.id, difficulty, question);
          generated += 1;
          avoid.push(question.prompt);
          console.log(`    ✓ ${difficulty} ${index + 1}/${perDifficulty}: ${question.prompt.slice(0, 72)}…`);
        } catch (err) {
          failed += 1;
          console.warn(`    ✗ ${difficulty} ${index + 1}/${perDifficulty}: ${err.message}`);
          break;
        }
      }
    }
  }

  // Guarantee at least one question per topic, even on a cold LLM.
  if (!fallbackOnly || generated === 0) {
    console.log('\nChecking for empty topics…');
    for (const topic of selected) {
      const { count } = await db()
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('topic_id', topic.id);
      if ((count || 0) > 0) continue;

      const fallback = FALLBACK_QUESTIONS.find((question) => question.slug === topic.slug);
      if (!fallback) {
        console.warn(`  ! No fallback question for ${topic.slug}`);
        continue;
      }
      try {
        await insertQuestion(topic.id, fallback.difficulty, fallback);
        generated += 1;
        console.log(`  + fallback question added for ${topic.name}`);
      } catch (err) {
        console.warn(`  ! Fallback failed for ${topic.name}: ${err.message}`);
      }
    }
  }

  if (withLessons) {
    console.log('\nPre-generating study lessons…');
    for (const topic of selected) {
      for (const difficulty of difficulties) {
        const existing = await db()
          .from('lessons')
          .select('id')
          .eq('topic_id', topic.id)
          .eq('difficulty', difficulty)
          .maybeSingle();
        if (existing.data) continue;
        try {
          const lesson = await generateLesson({
            topicName: topic.name,
            topicDescription: topic.description,
            difficulty,
            resources: resourcesFor(topic.slug),
          });
          await db().from('lessons').upsert(
            { topic_id: topic.id, difficulty, content: lesson },
            { onConflict: 'topic_id,difficulty' },
          );
          console.log(`  ✓ lesson: ${topic.slug} / ${difficulty}`);
        } catch (err) {
          console.warn(`  ✗ lesson ${topic.slug}/${difficulty}: ${err.message}`);
        }
      }
    }
  }

  console.log(`\nDone. generated=${generated} skipped=${skipped} failed=${failed}\n`);
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
