import { z } from 'zod';

export const difficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export const questionTypeSchema = z.enum(['mcq', 'numeric', 'short_text']);
export const attemptModeSchema = z.enum(['practice', 'self_study', 'practice_similar', 'spot_flaw']);

export const uuidSchema = z.string().uuid('Expected a valid id.');

export const mcqOptionList = z.array(z.string().min(1).max(400)).min(2).max(6);

export const generatedQuestionSchema = z.object({
  type: questionTypeSchema,
  prompt: z.string().min(15).max(2000),
  options: mcqOptionList.nullable().optional(),
  answer_key: z.string().min(1).max(800),
  rubric: z.string().min(3).max(1200),
  solution: z.string().min(20).max(5000),
  concept_tag: z.string().min(2).max(80),
});

export const gradeSchema = z.object({
  correct: z.boolean(),
  mistake_summary: z.string().max(600).default(''),
  concept_tag: z.string().min(2).max(80).default('General reasoning'),
  misconception: z.string().max(600).default(''),
});

export const hintSchema = z.object({
  hint: z.string().min(10).max(700),
});

export const selfStudySolutionSchema = z.object({
  final_answer: z.string().min(1).max(800),
  rubric: z.string().min(3).max(1200),
  solution: z.string().min(20).max(5000),
  concept_tag: z.string().min(2).max(80),
});

export const flawedQuestionSchema = z.object({
  prompt: z.string().min(15).max(2000),
  steps: z.array(z.string().min(5).max(500)).min(3).max(7),
  flawed_step: z.number().int().min(1).max(7),
  flaw_explanation: z.string().min(10).max(800),
  concept_tag: z.string().min(2).max(80),
  rubric: z.string().min(3).max(1200),
  solution: z.string().min(20).max(5000),
});

export const flawGradeSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().min(2).max(800),
  misconception: z.string().max(600).default(''),
  concept_tag: z.string().min(2).max(80).default('Spotting reasoning errors'),
});

export const lessonSchema = z.object({
  title: z.string().min(3).max(140),
  summary: z.string().min(10).max(500),
  sections: z
    .array(z.object({ heading: z.string().min(2).max(120), body: z.string().min(10).max(1600) }))
    .min(2)
    .max(6),
  key_takeaways: z.array(z.string().min(3).max(300)).min(2).max(6),
  check_yourself: z.string().min(5).max(400),
});

export const startPracticeSchema = z.object({
  topic_id: uuidSchema,
  difficulty: difficultySchema,
});

export const submitAnswerSchema = z.object({
  answer: z.string().trim().min(1, 'Write an attempt before submitting.').max(3000),
});

export const selfStudyStartSchema = z.object({
  question: z.string().trim().min(10, 'Paste at least 10 characters.').max(3000),
});

export const saveMistakeSchema = z.object({
  attempt_id: uuidSchema,
});

export const patchMistakeSchema = z.object({
  status: z.enum(['open', 'resolved']),
});

export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(2, 'Use at least 2 characters.').max(40, 'Keep it under 40 characters.'),
});

export const submitFlawSchema = z.object({
  step_index: z.number().int().min(1).max(7),
  explanation: z.string().trim().min(5, 'Explain why that step is wrong.').max(1500),
});

export const lessonQuerySchema = z.object({
  difficulty: difficultySchema.default('beginner'),
});

export const submitAnswer = submitAnswerSchema;
