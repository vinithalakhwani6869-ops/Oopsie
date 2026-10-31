import { Router } from 'express';
import { wrap } from '../errors.js';
import { startPracticeSchema } from '../schemas.js';
import { startPractice } from '../game.js';
import { aiLimiter } from '../rateLimit.js';

export const practiceRouter = Router();

practiceRouter.post(
  '/start',
  aiLimiter,
  wrap(async (req, res) => {
    const { topic_id, difficulty } = startPracticeSchema.parse(req.body);
    const payload = await startPractice({ userId: req.user.id, topicId: topic_id, difficulty });
    res.status(201).json(payload);
  }),
);
