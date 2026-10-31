import { Router } from 'express';
import { wrap } from '../errors.js';
import { submitAnswerSchema, submitFlawSchema } from '../schemas.js';
import { getAttemptPayload, submitAnswer, submitFlaw } from '../game.js';
import { aiLimiter } from '../rateLimit.js';

export const attemptsRouter = Router();

attemptsRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const payload = await getAttemptPayload({ userId: req.user.id, attemptId: req.params.id });
    res.json(payload);
  }),
);

attemptsRouter.post(
  '/:id/submit',
  aiLimiter,
  wrap(async (req, res) => {
    const { answer } = submitAnswerSchema.parse(req.body);
    const payload = await submitAnswer({ userId: req.user.id, attemptId: req.params.id, answer });
    res.json(payload);
  }),
);

attemptsRouter.post(
  '/:id/submit-flaw',
  aiLimiter,
  wrap(async (req, res) => {
    const { step_index, explanation } = submitFlawSchema.parse(req.body);
    const payload = await submitFlaw({
      userId: req.user.id,
      attemptId: req.params.id,
      stepIndex: step_index,
      explanation,
    });
    res.json(payload);
  }),
);
