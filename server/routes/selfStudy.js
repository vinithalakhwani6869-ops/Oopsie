import { Router } from 'express';
import { wrap } from '../errors.js';
import { startSelfStudy } from '../game.js';
import { selfStudyStartSchema } from '../schemas.js';
import { aiLimiter } from '../rateLimit.js';

export const selfStudyRouter = Router();

selfStudyRouter.post(
  '/start',
  aiLimiter,
  wrap(async (req, res) => {
    const { question } = selfStudyStartSchema.parse(req.body);
    const payload = await startSelfStudy({ userId: req.user.id, questionText: question });
    res.status(201).json(payload);
  }),
);
