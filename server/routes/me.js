import { Router } from 'express';
import { db } from '../supabase.js';
import { wrap } from '../errors.js';
import { updateProfileSchema } from '../schemas.js';

export const meRouter = Router();

function fallbackName(user) {
  const meta = user.user_metadata || {};
  const raw = meta.display_name || meta.full_name || meta.name || (user.email || '').split('@')[0] || 'Learner';
  return String(raw).trim().slice(0, 40) || 'Learner';
}

meRouter.get(
  '/',
  wrap(async (req, res) => {
    const user = req.user;
    let profile = null;

    const first = await db().from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (first.error) throw first.error;
    profile = first.data;

    if (!profile) {
      // Safety net for projects created before the auth trigger existed.
      const created = await db()
        .from('profiles')
        .insert({ id: user.id, display_name: fallbackName(user) })
        .select('*')
        .single();

      if (created.error) {
        if (created.error.code === '23505') {
          const retry = await db().from('profiles').select('*').eq('id', user.id).single();
          if (retry.error) throw retry.error;
          profile = retry.data;
        } else {
          throw created.error;
        }
      } else {
        profile = created.data;
      }
    }

    const rankRow = await db().from('leaderboard').select('rank').eq('user_id', user.id).maybeSingle();
    if (rankRow.error) throw rankRow.error;

    res.json({
      profile,
      rank: rankRow.data?.rank ?? null,
      email: user.email ?? null,
      avatar_url: user.user_metadata?.avatar_url || null,
    });
  }),
);

meRouter.patch(
  '/',
  wrap(async (req, res) => {
    const { display_name } = updateProfileSchema.parse(req.body);
    const { data, error } = await db()
      .from('profiles')
      .update({ display_name })
      .eq('id', req.user.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ profile: data });
  }),
);
