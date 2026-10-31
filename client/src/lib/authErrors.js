const RULES = [
  [/invalid login credentials/i, 'Email or password is incorrect. Try again.'],
  [/email not confirmed/i, 'Confirm your email first — check your inbox for the link.'],
  [/already registered|already exists|user already/i, 'That email already has an account. Sign in instead.'],
  [/password should be at least|password.*characters/i, 'Use a password with at least 8 characters.'],
  [/rate limit|too many requests|over_email_send_rate_limit/i, 'Too many attempts. Wait a minute and try again.'],

  // OAuth / provider configuration
  [
    /provider is not enabled|unsupported provider|provider is not supported/i,
    'Google sign-in is not enabled for this Supabase project. In Supabase go to Authentication -> Sign In / Providers -> Google, enable it, and paste your Google Client ID and Client Secret.',
  ],
  [
    /invalid_client|client secret|client id/i,
    'Google rejected the OAuth client. Re-check the Client ID and Client Secret in Supabase -> Authentication -> Providers -> Google. The secret is the Google one, not the Supabase anon key.',
  ],
  [
    /redirect_uri_mismatch|redirect uri mismatch|redirect_url not allowed|url not allowed|redirect.*not.*allowed/i,
    'The redirect URL was rejected. In Supabase -> Authentication -> URL Configuration add http://localhost:5173/auth/callback (and your production URL). In Google Cloud Console the authorized redirect URI must be https://<project-ref>.supabase.co/auth/v1/callback.',
  ],
  [
    /invalid api key|no api key|invalid apikey|invalid jwt/i,
    'The Supabase anon key in client/.env was rejected. Copy the anon/publishable key from Supabase -> Project Settings -> API (not the service_role key).',
  ],

  // Browser / flow state
  [
    /code verifier|code challenge|pkce|flow state|flow_state|state.*not found/i,
    'The browser could not verify this sign-in. Start again from the sign-in page, use the same address you started from (localhost or 127.0.0.1, not both), and do not switch browsers or clear site data mid-flow.',
  ],
  [/flow_state_expired|otp_expired|token has expired|link.*expired/i, 'This sign-in link expired. Start again from the sign-in page.'],
  [/database error saving new user/i, 'Supabase could not create your profile. Run supabase/setup.sql in the SQL editor, then try again.'],
  [/access_denied|user denied|cancell?ed|consent/i, 'Google sign-in was cancelled. Try again when you are ready.'],
  [/network|failed to fetch|load failed/i, 'Could not reach Supabase. Check your internet connection and that VITE_SUPABASE_URL is correct.'],
];

export function friendlyAuthError(message = '', { code = null, timedOut = false } = {}) {
  if (timedOut) {
    return 'Sign-in did not finish in time. The link may have expired, or Supabase returned to a different URL than the app started from. Try again from the sign-in page.';
  }

  const text = String(message || '').trim();
  const haystack = `${text} ${code || ''}`;

  for (const [pattern, friendly] of RULES) {
    if (pattern.test(haystack)) return friendly;
  }

  return text || 'Something went wrong. Please try again.';
}
