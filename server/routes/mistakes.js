import { Router } from 'express';
import { wrap } from '../errors.js';
import { saveMistakeSchema, patchMistakeSchema } from '../schemas.js';
import {
  getMistakeDetail,
  listMistakes,
  saveMistake,
  startSimilarPractice,
  startSpotTheFlaw,
  updateMistakeStatus,
} from '../game.js';
import { aiLimiter } from '../rateLimit.js';

export const mistakesRouter = Router();

mistakesRouter.get(
  '/',
  wrap(async (req, res) => {
    const mistakes = await listMistakes(req.user.id);
    res.json({
      mistakes,
      counts: {
        total: mistakes.length,
        open: mistakes.filter((row) => row.status === 'open').length,
        resolved: mistakes.filter((row) => row.status === 'resolved').length,
        practiced: mistakes.filter((row) => (row.times_practiced || 0) > 0).length,
      },
    });
  }),
);

mistakesRouter.post(
  '/',
  wrap(async (req, res) => {
    const { attempt_id } = saveMistakeSchema.parse(req.body);
    const result = await saveMistake({ userId: req.user.id, attemptId: attempt_id });
    res.status(201).json(result);
  }),
);

mistakesRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const mistake = await getMistakeDetail({ userId: req.user.id, mistakeId: req.params.id });
    res.json({ mistake });
  }),
);

mistakesRouter.patch(
  '/:id',
  wrap(async (req, res) => {
    const { status } = patchMistakeSchema.parse(req.body);
    const mistake = await updateMistakeStatus({ userId: req.user.id, mistakeId: req.params.id, status });
    res.json({ mistake });
  }),
);

mistakesRouter.post(
  '/:id/practice',
  aiLimiter,
  wrap(async (req, res) => {
    const payload = await startSimilarPractice({ userId: req.user.id, mistakeId: req.params.id });
    res.status(201).json(payload);
  }),
);

mistakesRouter.post(
  '/:id/spot-flaw',
  aiLimiter,
  wrap(async (req, res) => {
    const payload = await startSpotTheFlaw({ userId: req.user.id, mistakeId: req.params.id });
    res.status(201).json(payload);
  }),
);
