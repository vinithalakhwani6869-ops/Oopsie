import { Router } from 'express';
import { db } from '../supabase.js';
import { AppError, wrap } from '../errors.js';
import { config } from '../config.js';
import { buildHeatmap, computeMastery, computeStreaks, dayKey } from '../engine/stats.js';

export const statsRouter = Router();

statsRouter.get(
  '/',
  wrap(async (req, res) => {
    const userId = req.user.id;

    const profileResult = await db().from('profiles').select('total_points').eq('id', userId).maybeSingle();
    if (profileResult.error) throw new AppError(500, profileResult.error.message, 'db_error');

    const attemptsResult = await db()
      .from('attempts')
      .select('id, mode, status, hints_used, points, created_at, questions(topic_id, difficulty, topics(id, name, slug))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (attemptsResult.error) throw new AppError(500, attemptsResult.error.message, 'db_error');

    const attempts = attemptsResult.data || [];
    const completed = attempts.filter((row) => row.status !== 'in_progress');

    const solved = completed.filter((row) => row.status === 'solved').length;
    const { current, longest } = computeStreaks(attempts);
    const heatmap = buildHeatmap(attempts);

    const today = dayKey(new Date());
    const todayPoints = attempts
      .filter((row) => dayKey(row.created_at) === today)
      .reduce((sum, row) => sum + (row.points || 0), 0);

    // Mastery: last 10 scored attempts per topic, recency-weighted.
    const byTopic = new Map();
    for (const row of attempts) {
      if (row.mode === 'self_study') continue;
      if (row.status === 'in_progress') continue;
      const question = row.questions;
      if (!question?.topic_id) continue;
      if (!byTopic.has(question.topic_id)) {
        byTopic.set(question.topic_id, {
          topic: question.topics || { id: question.topic_id, name: 'Topic', slug: null },
          rows: [],
        });
      }
      byTopic.get(question.topic_id).rows.push(row);
    }

    const mastery = [...byTopic.values()]
      .map(({ topic, rows }) => {
        const recent = rows.slice(0, 10);
        const computed = computeMastery(recent);
        return {
          topic,
          score: computed.score,
          sample: computed.sample,
          formula: computed.formula,
          weighted_sum: computed.weighted_sum,
          weight_total: computed.weight_total,
          entries: computed.entries,
          attempts_count: rows.length,
          last_attempt_at: rows[0]?.created_at ?? null,
        };
      })
      .sort((a, b) => b.score - a.score || a.topic.name.localeCompare(b.topic.name));

    const mistakesResult = await db().from('mistakes').select('id, status, times_practiced').eq('user_id', userId);
    if (mistakesResult.error) throw new AppError(500, mistakesResult.error.message, 'db_error');
    const mistakes = mistakesResult.data || [];

    res.json({
      summary: {
        total_points: profileResult.data?.total_points ?? 0,
        total_attempts: attempts.length,
        total_solved: solved,
        total_revealed: completed.filter((row) => row.status === 'revealed').length,
        accuracy: completed.length ? Math.round((solved / completed.length) * 100) : 0,
        current_streak: current,
        longest_streak: longest,
        today_points: todayPoints,
        daily_cap: config.dailyPointCap,
      },
      mistakes: {
        saved: mistakes.length,
        open: mistakes.filter((row) => row.status === 'open').length,
        practiced: mistakes.filter((row) => (row.times_practiced || 0) > 0).length,
        resolved: mistakes.filter((row) => row.status === 'resolved').length,
      },
      heatmap,
      mastery,
    });
  }),
);
