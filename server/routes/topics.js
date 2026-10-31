import { Router } from 'express';
import { db } from '../supabase.js';
import { AppError, notFound, wrap } from '../errors.js';
import { lessonQuerySchema } from '../schemas.js';
import { resourcesFor } from '../seed/resources.js';
import { generateLesson } from '../llm.js';
import { aiLimiter } from '../rateLimit.js';

export const topicsRouter = Router();

async function loadTopicBySlug(slug) {
  const { data, error } = await db().from('topics').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new AppError(500, error.message, 'db_error');
  if (!data) throw notFound('That topic does not exist.');
  return data;
}

topicsRouter.get(
  '/',
  wrap(async (_req, res) => {
    const { data: topics, error } = await db().from('topics').select('*').order('sort_order', { ascending: true });
    if (error) throw new AppError(500, error.message, 'db_error');

    const { data: questions } = await db().from('questions').select('topic_id');
    const counts = new Map();
    for (const row of questions || []) {
      if (row.topic_id) counts.set(row.topic_id, (counts.get(row.topic_id) || 0) + 1);
    }

    res.json({
      topics: (topics || []).map((topic) => ({
        ...topic,
        question_count: counts.get(topic.id) || 0,
        resources: resourcesFor(topic.slug),
      })),
    });
  }),
);

topicsRouter.get(
  '/:slug',
  wrap(async (req, res) => {
    const topic = await loadTopicBySlug(req.params.slug);

    const { data: questions } = await db().from('questions').select('difficulty').eq('topic_id', topic.id);
    const byDifficulty = { beginner: 0, intermediate: 0, advanced: 0 };
    for (const row of questions || []) {
      if (byDifficulty[row.difficulty] !== undefined) byDifficulty[row.difficulty] += 1;
    }

    res.json({
      topic,
      resources: resourcesFor(topic.slug),
      question_counts: byDifficulty,
    });
  }),
);

topicsRouter.get(
  '/:slug/lesson',
  aiLimiter,
  wrap(async (req, res) => {
    const topic = await loadTopicBySlug(req.params.slug);
    const { difficulty } = lessonQuerySchema.parse(req.query);
    const resources = resourcesFor(topic.slug);

    const cached = await db()
      .from('lessons')
      .select('*')
      .eq('topic_id', topic.id)
      .eq('difficulty', difficulty)
      .maybeSingle();
    if (cached.error) throw new AppError(500, cached.error.message, 'db_error');

    if (cached.data) {
      return res.json({
        lesson: cached.data.content,
        resources,
        difficulty,
        cached: true,
        generated_at: cached.data.created_at,
      });
    }

    const lesson = await generateLesson({
      topicName: topic.name,
      topicDescription: topic.description,
      difficulty,
      resources,
    });

    const stored = await db()
      .from('lessons')
      .upsert({ topic_id: topic.id, difficulty, content: lesson }, { onConflict: 'topic_id,difficulty' })
      .select('created_at')
      .single();

    res.json({
      lesson,
      resources,
      difficulty,
      cached: false,
      generated_at: stored.data?.created_at ?? new Date().toISOString(),
    });
  }),
);
