import rateLimit from 'express-rate-limit';

// Cheap protection for every API route.
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many requests. Give it a minute and try again.', code: 'rate_limited' },
});

// LLM-backed routes are expensive. Limit per learner, not per IP.
export const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    error: "You're moving fast! AI requests are capped at 30 per 5 minutes. Take a breath and try again shortly.",
    code: 'rate_limited',
  },
});
