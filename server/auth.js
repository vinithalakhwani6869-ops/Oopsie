import { supabaseAdmin } from './supabase.js';
import { AppError } from './errors.js';

function bearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function requireAuth(req, _res, next) {
  try {
    if (!supabaseAdmin) {
      throw new AppError(
        503,
        'Auth is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to server/.env.',
        'auth_not_configured',
      );
    }

    const token = bearer(req);
    if (!token) throw new AppError(401, 'Missing access token.', 'unauthorized');

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) throw new AppError(401, 'Your session has expired. Please sign in again.', 'unauthorized');

    req.user = data.user;
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}
