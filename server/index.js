import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { config, describeConfig } from './config.js';
import { AppError } from './errors.js';
import { requireAuth } from './auth.js';
import { generalLimiter } from './rateLimit.js';
import { meRouter } from './routes/me.js';
import { topicsRouter } from './routes/topics.js';
import { practiceRouter } from './routes/practice.js';
import { selfStudyRouter } from './routes/selfStudy.js';
import { attemptsRouter } from './routes/attempts.js';
import { mistakesRouter } from './routes/mistakes.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { statsRouter } from './routes/stats.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const localhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.clientOrigins.includes(origin) || localhost.test(origin)) return callback(null, true);
      return callback(new AppError(403, `Origin ${origin} is not allowed.`, 'cors_blocked'));
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'oopsie', config: describeConfig() });
});

app.use('/api', requireAuth, generalLimiter);
app.use('/api/me', meRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/practice', practiceRouter);
app.use('/api/self-study', selfStudyRouter);
app.use('/api/attempts', attemptsRouter);
app.use('/api/mistakes', mistakesRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/stats', statsRouter);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}.`, code: 'not_found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.issues[0]?.message || 'Invalid input.',
      code: 'validation_error',
      issues: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
    return;
  }

  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'That request is too large.', code: 'too_large' });
    return;
  }

  console.error('[server] unhandled error:', err);
  const status = Number.isInteger(err?.status) ? err.status : 500;
  const message =
    status >= 500
      ? err?.message || 'Something went wrong on our side. Please try again.'
      : err?.message || 'Request failed.';
  res.status(status).json({ error: message, code: err?.code || 'server_error' });
});

app.listen(config.port, () => {
  const info = describeConfig();
  console.log(`\n  Oopsie API  →  http://localhost:${config.port}`);
  console.log(`  database    →  ${info.database ? 'configured' : 'MISSING (set server/.env)'}`);
  console.log(`  LLM         →  ${info.llm ? info.model : 'MISSING (set server/.env)'}\n`);
});
