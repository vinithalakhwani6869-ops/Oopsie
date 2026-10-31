import { Router } from 'express';
import { db } from '../supabase.js';
import { AppError, wrap } from '../errors.js';
import { config } from '../config.js';

export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/',
  wrap(async (req, res) => {
    const userId = req.user.id;

    const { data: rows, error } = await db()
      .from('leaderboard')
      .select('user_id, rank, display_name, points')
      .order('rank', { ascending: true })
      .limit(100);
    if (error) throw new AppError(500, error.message, 'db_error');

    const meRow = await db()
      .from('leaderboard')
      .select('user_id, rank, display_name, points')
      .eq('user_id', userId)
      .maybeSingle();
    if (meRow.error) throw new AppError(500, meRow.error.message, 'db_error');

    const total = await db().from('leaderboard').select('*', { count: 'exact', head: true });

    const entries = (rows || []).map((row) => ({
      rank: Number(row.rank),
      display_name: row.display_name,
      points: row.points,
      is_me: row.user_id === userId,
    }));

    const me = meRow.data
      ? {
          rank: Number(meRow.data.rank),
          display_name: meRow.data.display_name,
          points: meRow.data.points,
          is_me: true,
        }
      : null;

    res.json({
      entries,
      me,
      total_players: total.count ?? entries.length,
      daily_cap: config.dailyPointCap,
    });
  }),
);
