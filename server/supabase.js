import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { AppError } from './errors.js';

export const isDbConfigured = Boolean(config.supabaseUrl && config.supabaseServiceKey);

export const supabaseAdmin = isDbConfigured
  ? createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-application-name': 'oopsie-server' } },
    })
  : null;

export function db() {
  if (!supabaseAdmin) {
    throw new AppError(
      503,
      'The database is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to server/.env.',
      'db_not_configured',
    );
  }
  return supabaseAdmin;
}

export function assertNoDbError(error, context = 'Database error') {
  if (!error) return;
  throw new AppError(500, `${context}: ${error.message}`, 'db_error');
}
