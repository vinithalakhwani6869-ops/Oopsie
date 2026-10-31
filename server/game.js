import { db } from './supabase.js';
import { config } from './config.js';
import { AppError, badRequest, conflict, notFound } from './errors.js';
import {
  pointsFor,
  hintLeaksAnswer,
  fallbackHint,
  mcqMatches,
  numericMatches,
} from './engine/ladder.js';
import {
  generateQuestion,
  generateSimilarQuestion,
  generateHint,
  gradeAttempt,
  solveSelfStudyQuestion,
  generateFlawedQuestion,
  gradeFlawSelection,
} from './llm.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const QUESTION_SELECT = '*, topics(id, name, slug)';

async function loadTopic(topicId) {
  const { data, error } = await db().from('topics').select('*').eq('id', topicId).maybeSingle();
  if (error) throw new AppError(500, `Could not load topic: ${error.message}`, 'db_error');
  if (!data) throw notFound('That topic does not exist.');
  return data;
}

async function loadAttempt(userId, attemptId) {
  const { data, error } = await db()
    .from('attempts')
    .select(`*, questions(${QUESTION_SELECT})`)
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new AppError(500, `Could not load attempt: ${error.message}`, 'db_error');
  if (!data) throw notFound('Attempt not found.');
  if (!data.questions) throw new AppError(410, 'The question for this attempt is no longer available.', 'question_missing');
  return data;
}

async function loadMistake(userId, mistakeId) {
  const { data, error } = await db()
    .from('mistakes')
    .select('*, topics(id, name, slug), questions(difficulty, prompt)')
    .eq('id', mistakeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new AppError(500, `Could not load mistake: ${error.message}`, 'db_error');
  if (!data) throw notFound('Mistake not found.');
  return data;
}

function publicQuestion(attempt, question) {
  const result = {
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    options: Array.isArray(question.options) ? question.options : null,
    difficulty: question.difficulty,
    topic_id: question.topic_id,
  };

  // SECURITY: the answer key and solution only leave the server once the
  // session is finished. Until then the client cannot see them.
  if (attempt.status !== 'in_progress') {
    result.answer_key = question.answer_key;
    result.solution = question.solution;
    result.rubric = question.rubric;
    if (question.flaw) result.flaw = question.flaw;
  }

  return result;
}

function attemptSummary(attempt) {
  return {
    id: attempt.id,
    mode: attempt.mode,
    hints_used: attempt.hints_used,
    points: attempt.points,
    status: attempt.status,
    mistake_id: attempt.mistake_id,
    created_at: attempt.created_at,
  };
}

export async function buildAttemptPayload({ attempt, question, extra = {} }) {
  const transcript = Array.isArray(attempt.transcript) ? attempt.transcript : [];

  let mistakeSaved = false;
  if (question?.id) {
    const { data } = await db()
      .from('mistakes')
      .select('id')
      .eq('user_id', attempt.user_id)
      .eq('question_id', question.id)
      .limit(1);
    mistakeSaved = Boolean(data?.length);
  }

  return {
    attempt: attemptSummary(attempt),
    question: publicQuestion(attempt, question),
    topic: question.topics ?? null,
    hints: transcript.filter((entry) => entry.kind === 'hint'),
    submissions: transcript.filter((entry) => entry.kind === 'attempt'),
    can_save_mistake: attempt.status === 'revealed' && !mistakeSaved,
    mistake_saved: mistakeSaved,
    potential_points: attempt.status === 'in_progress' ? pointsFor(attempt.hints_used) : attempt.points,
    daily_cap: config.dailyPointCap,
    ...extra,
  };
}

async function insertQuestion({
  topicId,
  difficulty,
  type,
  prompt,
  options,
  answerKey,
  rubric,
  solution,
  flaw = null,
  source = 'generated',
  conceptTag = null,
}) {
  const { data, error } = await db()
    .from('questions')
    .insert({
      topic_id: topicId,
      difficulty,
      type,
      prompt,
      options: options ?? null,
      answer_key: answerKey,
      rubric,
      solution,
      flaw,
      source,
      concept_tag: conceptTag,
    })
    .select(QUESTION_SELECT)
    .single();

  if (error) throw new AppError(500, `Could not store the question: ${error.message}`, 'db_error');
  return data;
}

async function createAttempt({ userId, question, mode, mistakeId = null, extra = {} }) {
  const { data, error } = await db()
    .from('attempts')
    .insert({
      user_id: userId,
      question_id: question.id,
      mode,
      mistake_id: mistakeId,
      status: 'in_progress',
      hints_used: 0,
      points: 0,
      transcript: [],
    })
    .select('*')
    .single();

  if (error) throw new AppError(500, `Could not start the attempt: ${error.message}`, 'db_error');

  return buildAttemptPayload({ attempt: data, question, extra });
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

async function computeAward({ userId, questionId, attemptId, rawPoints }) {
  if (rawPoints <= 0) {
    return { raw: 0, awarded: 0, cap_reached: false, reason: 'no_points_left', daily_cap: config.dailyPointCap };
  }

  const { data: prior, error: priorError } = await db()
    .from('attempts')
    .select('id')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .eq('status', 'solved')
    .neq('id', attemptId)
    .limit(1);
  if (priorError) throw new AppError(500, priorError.message, 'db_error');
  if (prior?.length) {
    return { raw: rawPoints, awarded: 0, cap_reached: false, reason: 'already_scored', daily_cap: config.dailyPointCap };
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { data: today, error: todayError } = await db()
    .from('attempts')
    .select('points')
    .eq('user_id', userId)
    .in('mode', ['practice', 'practice_similar', 'spot_flaw'])
    .gte('created_at', dayStart.toISOString())
    .neq('id', attemptId);
  if (todayError) throw new AppError(500, todayError.message, 'db_error');

  const used = (today || []).reduce((sum, row) => sum + (row.points || 0), 0);
  const awarded = Math.max(0, Math.min(rawPoints, config.dailyPointCap - used));

  return {
    raw: rawPoints,
    awarded,
    cap_reached: awarded < rawPoints,
    reason: awarded < rawPoints ? 'daily_cap' : 'ok',
    daily_used_before: used,
    daily_cap: config.dailyPointCap,
  };
}

async function addPoints(userId, points) {
  if (points <= 0) return;
  const { error } = await db().rpc('add_points', { p_user: userId, p_points: points });
  if (error) {
    console.error('[points] add_points failed:', error.message);
    throw new AppError(500, 'Points could not be recorded. Please try again.', 'points_error');
  }
}

// ---------------------------------------------------------------------------
// Hint generation (with a no-answer-leak guard and an outage fallback)
// ---------------------------------------------------------------------------

function flawHintLeaks(hint, flaw) {
  const stepPattern = new RegExp(`\\bstep\\s*#?\\s*${flaw.flawed_step}\\b`, 'i');
  if (stepPattern.test(hint)) return true;
  const explanation = String(flaw.flaw_explanation || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const normalized = String(hint).toLowerCase().replace(/\s+/g, ' ');
  if (explanation.length > 40) {
    const fragment = explanation.slice(0, 40);
    if (normalized.includes(fragment)) return true;
  }
  return false;
}

async function safeHint({ question, answer, mistakeSummary, level, transcript, flaw = null }) {
  const previousHints = transcript.filter((entry) => entry.kind === 'hint').map((entry) => entry.content);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await generateHint({
        question: question.prompt,
        answerKey: flaw ? `Step ${flaw.flawed_step} (never name the step number)` : question.answer_key,
        rubric: flaw
          ? `${question.rubric}\nThe flaw is in step ${flaw.flawed_step}: ${flaw.flaw_explanation}`
          : question.rubric,
        answer,
        mistakeSummary,
        level,
        previousHints,
      });
      const leaks = flaw
        ? flawHintLeaks(result.hint, flaw)
        : hintLeaksAnswer(result.hint, question.answer_key);
      if (!leaks) return result.hint;
    } catch (err) {
      console.warn('[hint] generation failed, using fallback:', err.message);
      break;
    }
  }

  return flaw
    ? [
        'Read each step as a claim. One step quietly assumes something the question never gave you. Which assumption is doing too much work?',
        'Compare the step that changes the quantity or category with the definition it relies on. The slip is a reasoning move, not a typo.',
        'Check the middle of the argument: does each line preserve the conditions from the one before? The break happens where that preservation fails.',
      ][Math.min(level, 3) - 1]
    : fallbackHint(level, question.concept_tag);
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

function defaultMistakeFor(type) {
  if (type === 'numeric') return 'The arithmetic or unit conversion did not match the conditions in the prompt.';
  if (type === 'mcq') return 'The chosen option follows a different rule than the one this question tests.';
  return 'The reasoning drifted from the conditions in the prompt.';
}

async function gradeSubmission(question, answer) {
  const conceptTag = question.concept_tag || 'Core concept';

  if (question.type === 'mcq' && mcqMatches(answer, question.answer_key)) {
    return { correct: true, mistake_summary: '', concept_tag: conceptTag, misconception: '' };
  }
  if (question.type === 'numeric' && numericMatches(answer, question.answer_key)) {
    return { correct: true, mistake_summary: '', concept_tag: conceptTag, misconception: '' };
  }

  try {
    return await gradeAttempt({
      question: question.prompt,
      answerKey: question.answer_key,
      rubric: question.rubric,
      answer,
      type: question.type,
    });
  } catch (err) {
    if (question.type === 'short_text') throw err;
    console.warn('[grade] falling back to local grade:', err.message);
    return {
      correct: false,
      mistake_summary: defaultMistakeFor(question.type),
      concept_tag: conceptTag,
      misconception: 'Needs another pass at the underlying rule.',
    };
  }
}

// ---------------------------------------------------------------------------
// Starters
// ---------------------------------------------------------------------------

async function storedQuestionCandidates(userId, topicId, difficulty) {
  const { data: answered } = await db()
    .from('attempts')
    .select('question_id')
    .eq('user_id', userId)
    .limit(1000);
  const seen = new Set((answered || []).map((row) => row.question_id).filter(Boolean));

  const { data: rows, error } = await db()
    .from('questions')
    .select(QUESTION_SELECT)
    .eq('topic_id', topicId)
    .eq('difficulty', difficulty)
    .is('flaw', null)
    .limit(50);
  if (error) throw new AppError(500, `Could not load questions: ${error.message}`, 'db_error');

  const all = rows || [];
  return { all, unused: all.filter((row) => !seen.has(row.id)) };
}

async function anyStoredQuestion(topicId) {
  const { data, error } = await db()
    .from('questions')
    .select(QUESTION_SELECT)
    .eq('topic_id', topicId)
    .is('flaw', null)
    .limit(50);
  if (error) throw new AppError(500, `Could not load questions: ${error.message}`, 'db_error');
  return data || [];
}

function pickRandom(rows) {
  return rows[Math.floor(Math.random() * rows.length)];
}

export async function startPractice({ userId, topicId, difficulty }) {
  const topic = await loadTopic(topicId);

  // Prefer a stored question the learner has not seen. Seeded questions make
  // the app usable without a live LLM; generated ones fill in as they run out.
  const pool = await storedQuestionCandidates(userId, topicId, difficulty);
  if (pool.unused.length) {
    return createAttempt({ userId, question: pickRandom(pool.unused), mode: 'practice' });
  }

  const { data: recent } = await db()
    .from('questions')
    .select('prompt')
    .eq('topic_id', topic.id)
    .eq('difficulty', difficulty)
    .order('created_at', { ascending: false })
    .limit(5);

  let generated;
  try {
    generated = await generateQuestion({
      topicName: topic.name,
      topicDescription: topic.description,
      difficulty,
      avoid: (recent || []).map((row) => row.prompt),
    });
  } catch (err) {
    // A repeat question still supports the hint ladder and streaks, even
    // though it will not pay points twice. If the requested difficulty has no
    // stored question (common with the offline fallback bank), use any stored
    // question for the topic rather than failing the session.
    const fallbackPool = pool.all.length ? pool.all : await anyStoredQuestion(topicId);
    if (fallbackPool.length) {
      console.warn('[practice] generation failed, reusing a stored question:', err.message);
      return createAttempt({ userId, question: pickRandom(fallbackPool), mode: 'practice' });
    }
    throw err;
  }

  const question = await insertQuestion({
    topicId: topic.id,
    difficulty,
    type: generated.type,
    prompt: generated.prompt,
    options: generated.options,
    answerKey: generated.answer_key,
    rubric: generated.rubric,
    solution: generated.solution,
    conceptTag: generated.concept_tag,
    source: 'generated',
  });

  return createAttempt({ userId, question, mode: 'practice' });
}

export async function startSelfStudy({ userId, questionText }) {
  const reference = await solveSelfStudyQuestion({ question: questionText });

  const question = await insertQuestion({
    topicId: null,
    difficulty: 'intermediate',
    type: 'short_text',
    prompt: questionText,
    options: null,
    answerKey: reference.final_answer,
    rubric: reference.rubric,
    solution: reference.solution,
    source: 'user',
    conceptTag: reference.concept_tag,
  });

  return createAttempt({
    userId,
    question,
    mode: 'self_study',
    extra: { note: 'Reference solution is AI-generated. Verify independently.' },
  });
}

export async function startSimilarPractice({ userId, mistakeId }) {
  const mistake = await loadMistake(userId, mistakeId);
  const difficulty = mistake.questions?.difficulty || 'intermediate';
  const topicName = mistake.topics?.name || 'General reasoning';

  const generated = await generateSimilarQuestion({
    topicName,
    conceptTag: mistake.concept_tag,
    misconception: mistake.misconception,
    difficulty,
  });

  const question = await insertQuestion({
    topicId: mistake.topic_id,
    difficulty,
    type: generated.type,
    prompt: generated.prompt,
    options: generated.options,
    answerKey: generated.answer_key,
    rubric: generated.rubric,
    solution: generated.solution,
    conceptTag: generated.concept_tag || mistake.concept_tag,
    source: 'generated',
  });

  await db()
    .from('mistakes')
    .update({ times_practiced: (mistake.times_practiced || 0) + 1 })
    .eq('id', mistake.id)
    .eq('user_id', userId);

  return createAttempt({
    userId,
    question,
    mode: 'practice_similar',
    mistakeId: mistake.id,
    extra: { mistake: { id: mistake.id, concept_tag: mistake.concept_tag } },
  });
}

export async function startSpotTheFlaw({ userId, mistakeId }) {
  const mistake = await loadMistake(userId, mistakeId);
  const difficulty = mistake.questions?.difficulty || 'intermediate';
  const topicName = mistake.topics?.name || 'General reasoning';

  const generated = await generateFlawedQuestion({
    topicName,
    conceptTag: mistake.concept_tag,
    misconception: mistake.misconception,
    difficulty,
  });

  const question = await insertQuestion({
    topicId: mistake.topic_id,
    difficulty,
    type: 'short_text',
    prompt: generated.prompt,
    options: generated.steps,
    answerKey: `Step ${generated.flawed_step}`,
    rubric: generated.rubric,
    solution: generated.solution,
    flaw: {
      flawed_step: generated.flawed_step,
      flaw_explanation: generated.flaw_explanation,
    },
    source: 'generated',
    conceptTag: generated.concept_tag || mistake.concept_tag,
  });

  await db()
    .from('mistakes')
    .update({ times_practiced: (mistake.times_practiced || 0) + 1 })
    .eq('id', mistake.id)
    .eq('user_id', userId);

  return createAttempt({
    userId,
    question,
    mode: 'spot_flaw',
    mistakeId: mistake.id,
    extra: { mistake: { id: mistake.id, concept_tag: mistake.concept_tag } },
  });
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export async function getAttemptPayload({ userId, attemptId }) {
  const attempt = await loadAttempt(userId, attemptId);
  return buildAttemptPayload({ attempt, question: attempt.questions });
}

async function finishAttempt({ attempt, status, points, hintsUsed, transcript }) {
  const { data, error } = await db()
    .from('attempts')
    .update({ status, points, hints_used: hintsUsed, transcript })
    .eq('id', attempt.id)
    .eq('user_id', attempt.user_id)
    .eq('status', 'in_progress')
    .select('*')
    .maybeSingle();

  if (error) {
    // A partial unique index guarantees one points award per question.
    if (error.code === '23505') {
      const retry = await db()
        .from('attempts')
        .update({ status, points: 0, hints_used: hintsUsed, transcript })
        .eq('id', attempt.id)
        .eq('user_id', attempt.user_id)
        .eq('status', 'in_progress')
        .select('*')
        .maybeSingle();
      if (retry.error) throw new AppError(500, `Could not finish the attempt: ${retry.error.message}`, 'db_error');
      return { row: retry.data, points: 0, duplicate: true };
    }
    throw new AppError(500, `Could not finish the attempt: ${error.message}`, 'db_error');
  }
  if (!data) throw conflict('This attempt has already been submitted.', 'already_submitted');
  return { row: data, points, duplicate: false };
}

export async function submitAnswer({ userId, attemptId, answer }) {
  const attempt = await loadAttempt(userId, attemptId);
  if (attempt.mode === 'spot_flaw') throw badRequest('Use the Spot the Flaw submission for this attempt.');
  if (attempt.status !== 'in_progress') throw conflict('This session is already finished.', 'already_finished');

  const question = attempt.questions;
  const transcript = Array.isArray(attempt.transcript) ? [...attempt.transcript] : [];
  const now = new Date().toISOString();

  const graded = await gradeSubmission(question, answer);
  transcript.push({
    kind: 'attempt',
    answer,
    correct: Boolean(graded.correct),
    mistake_summary: graded.mistake_summary || '',
    concept_tag: graded.concept_tag || question.concept_tag || 'Core concept',
    misconception: graded.misconception || '',
    at: now,
  });

  let status = 'in_progress';
  let hintsUsed = attempt.hints_used;
  let points = 0;
  let award = null;

  if (graded.correct) {
    status = 'solved';
    const rawPoints = attempt.mode === 'self_study' ? 0 : pointsFor(attempt.hints_used);
    award =
      attempt.mode === 'self_study'
        ? { raw: 0, awarded: 0, cap_reached: false, reason: 'self_study', daily_cap: config.dailyPointCap }
        : await computeAward({
            userId,
            questionId: question.id,
            attemptId: attempt.id,
            rawPoints,
          });
    points = award.awarded;
    transcript.push({
      kind: 'solution',
      answer_key: question.answer_key,
      solution: question.solution,
      at: now,
    });
  } else if (attempt.hints_used < 3) {
    hintsUsed = attempt.hints_used + 1;
    const hint = await safeHint({
      question,
      answer,
      mistakeSummary: graded.mistake_summary,
      level: hintsUsed,
      transcript,
    });
    transcript.push({ kind: 'hint', level: hintsUsed, content: hint, at: new Date().toISOString() });
  } else {
    status = 'revealed';
    transcript.push({
      kind: 'solution',
      answer_key: question.answer_key,
      solution: question.solution,
      at: now,
    });
  }

  const finished = await finishAttempt({ attempt, status, points, hintsUsed, transcript });
  if (finished.points > 0) await addPoints(userId, finished.points);
  if (finished.duplicate && award) award = { ...award, awarded: 0, reason: 'already_scored' };

  let resolution = null;
  if (status === 'solved' && attempt.mode === 'practice_similar' && attempt.mistake_id) {
    resolution = await maybeResolveMistake(attempt.mistake_id);
  }

  return buildAttemptPayload({
    attempt: finished.row,
    question,
    extra: { award, resolution, note: attempt.mode === 'self_study' ? 'AI-generated reference, verify independently.' : undefined },
  });
}

export async function submitFlaw({ userId, attemptId, stepIndex, explanation }) {
  const attempt = await loadAttempt(userId, attemptId);
  if (attempt.mode !== 'spot_flaw') throw badRequest('This attempt is not a Spot the Flaw exercise.');
  if (attempt.status !== 'in_progress') throw conflict('This session is already finished.', 'already_finished');

  const question = attempt.questions;
  const flaw = question.flaw;
  if (!flaw || !Number.isInteger(flaw.flawed_step)) {
    throw new AppError(500, 'This exercise is missing its flaw metadata.', 'flaw_missing');
  }

  const steps = Array.isArray(question.options) ? question.options : [];
  const step = Number(stepIndex);
  if (step < 1 || step > steps.length) throw badRequest('Pick one of the listed steps.');

  const transcript = Array.isArray(attempt.transcript) ? [...attempt.transcript] : [];
  const now = new Date().toISOString();
  const chosenText = steps[step - 1] || '';

  let graded;
  if (step !== flaw.flawed_step) {
    graded = {
      correct: false,
      feedback: `Step ${step} holds up — it follows from the line before it. Look for the step that quietly breaks a condition instead.`,
      concept_tag: question.concept_tag || 'Spotting reasoning errors',
      misconception: 'The selected step is valid; the real error is elsewhere in the chain.',
    };
  } else {
    graded = await gradeFlawSelection({
      question: question.prompt,
      steps,
      flawStep: flaw.flawed_step,
      flawExplanation: flaw.flaw_explanation,
      chosenStep: `Step ${step}: ${chosenText}`,
      explanation,
    });
  }

  transcript.push({
    kind: 'attempt',
    answer: `Step ${step}`,
    step_index: step,
    step_text: chosenText,
    explanation,
    correct: Boolean(graded.correct),
    feedback: graded.feedback,
    mistake_summary: graded.feedback,
    concept_tag: graded.concept_tag || question.concept_tag || 'Spotting reasoning errors',
    misconception: graded.misconception || '',
    at: now,
  });

  let status = 'in_progress';
  let hintsUsed = attempt.hints_used;
  let points = 0;
  let award = null;

  if (graded.correct) {
    status = 'solved';
    award = await computeAward({
      userId,
      questionId: question.id,
      attemptId: attempt.id,
      rawPoints: pointsFor(attempt.hints_used),
    });
    points = award.awarded;
    transcript.push({
      kind: 'solution',
      answer_key: question.answer_key,
      solution: question.solution,
      flaw,
      at: now,
    });
  } else if (attempt.hints_used < 3) {
    hintsUsed = attempt.hints_used + 1;
    const hint = await safeHint({
      question,
      answer: `Selected step ${step}: ${chosenText}. Explanation: ${explanation}`,
      mistakeSummary: graded.feedback,
      level: hintsUsed,
      transcript,
      flaw,
    });
    transcript.push({ kind: 'hint', level: hintsUsed, content: hint, at: new Date().toISOString() });
  } else {
    status = 'revealed';
    transcript.push({
      kind: 'solution',
      answer_key: question.answer_key,
      solution: question.solution,
      flaw,
      at: now,
    });
  }

  const finished = await finishAttempt({ attempt, status, points, hintsUsed, transcript });
  if (finished.points > 0) await addPoints(userId, finished.points);
  if (finished.duplicate && award) award = { ...award, awarded: 0, reason: 'already_scored' };

  return buildAttemptPayload({ attempt: finished.row, question, extra: { award } });
}

// ---------------------------------------------------------------------------
// Mistakes
// ---------------------------------------------------------------------------

export async function maybeResolveMistake(mistakeId) {
  const { count, error } = await db()
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('mistake_id', mistakeId)
    .eq('mode', 'practice_similar')
    .eq('status', 'solved')
    .lte('hints_used', 1);

  if (error) {
    console.error('[mistakes] resolution count failed:', error.message);
    return null;
  }

  const qualifying = count || 0;
  if (qualifying >= 2) {
    await db().from('mistakes').update({ status: 'resolved' }).eq('id', mistakeId).eq('status', 'open');
  }
  return { qualifying, needed: 2, resolved: qualifying >= 2 };
}

export async function saveMistake({ userId, attemptId }) {
  const attempt = await loadAttempt(userId, attemptId);
  if (attempt.status !== 'revealed') {
    throw conflict('Save is available once the worked solution has been revealed.', 'not_revealed');
  }

  const transcript = Array.isArray(attempt.transcript) ? attempt.transcript : [];
  const lastWrong = [...transcript].reverse().find((entry) => entry.kind === 'attempt' && entry.correct === false);
  const question = attempt.questions;

  const payload = {
    user_id: userId,
    question_id: question.id,
    topic_id: question.topic_id,
    concept_tag: lastWrong?.concept_tag || question.concept_tag || 'General',
    misconception:
      lastWrong?.misconception ||
      lastWrong?.mistake_summary ||
      lastWrong?.feedback ||
      'The first attempt missed a key condition.',
    user_attempt: lastWrong?.answer || lastWrong?.explanation || '',
    status: 'open',
  };

  const { data, error } = await db().from('mistakes').insert(payload).select('*').single();
  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await db()
        .from('mistakes')
        .select('*')
        .eq('user_id', userId)
        .eq('question_id', question.id)
        .maybeSingle();
      return { mistake: existing, already_saved: true };
    }
    throw new AppError(500, `Could not save the mistake: ${error.message}`, 'db_error');
  }

  return { mistake: data, already_saved: false };
}

export async function listMistakes(userId) {
  const { data, error } = await db()
    .from('mistakes')
    .select('*, topics(id, name, slug), questions(prompt, difficulty)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message, 'db_error');

  const ids = (data || []).map((row) => row.id);
  let qualifying = [];
  if (ids.length) {
    const { data: attempts } = await db()
      .from('attempts')
      .select('mistake_id')
      .in('mistake_id', ids)
      .eq('mode', 'practice_similar')
      .eq('status', 'solved')
      .lte('hints_used', 1);
    qualifying = attempts || [];
  }

  const counts = new Map();
  for (const row of qualifying) counts.set(row.mistake_id, (counts.get(row.mistake_id) || 0) + 1);

  return (data || []).map((row) => ({
    ...row,
    resolution: {
      qualifying: counts.get(row.id) || 0,
      needed: 2,
      complete: row.status === 'resolved',
    },
  }));
}

export async function getMistakeDetail({ userId, mistakeId }) {
  const mistake = await loadMistake(userId, mistakeId);

  const [recentResult, qualifyingResult] = await Promise.all([
    db()
      .from('attempts')
      .select('id, mode, status, hints_used, points, created_at')
      .eq('user_id', userId)
      .eq('mistake_id', mistakeId)
      .order('created_at', { ascending: false })
      .limit(10),
    db()
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('mistake_id', mistakeId)
      .eq('mode', 'practice_similar')
      .eq('status', 'solved')
      .lte('hints_used', 1),
  ]);

  if (recentResult.error) throw new AppError(500, recentResult.error.message, 'db_error');
  if (qualifyingResult.error) throw new AppError(500, qualifyingResult.error.message, 'db_error');

  return {
    ...mistake,
    resolution: {
      qualifying: qualifyingResult.count || 0,
      needed: 2,
      complete: mistake.status === 'resolved',
    },
    recent_attempts: recentResult.data || [],
  };
}

export async function updateMistakeStatus({ userId, mistakeId, status }) {
  const { data, error } = await db()
    .from('mistakes')
    .update({ status })
    .eq('id', mistakeId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) throw new AppError(500, error.message, 'db_error');
  if (!data) throw notFound('Mistake not found.');
  return data;
}
