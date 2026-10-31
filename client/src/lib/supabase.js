import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Values copied from .env.example. The app must not pretend these are real
// credentials: Google sign-in would otherwise redirect to a project that does
// not exist and fail with a DNS error.
const URL_PLACEHOLDERS = [
  'your-project.supabase.co',
  'your-project-url',
  'your-project',
  'example.com',
  'changeme',
  'replace-me',
];

const KEY_PLACEHOLDERS = [
  'your-anon-key',
  'your-supabase-anon-key',
  'eyjhbgeioi...',
  'changeme',
  'replace-me',
];

function looksLikePlaceholder(value, needles) {
  const lower = value.toLowerCase();
  return (
    needles.some((needle) => lower.includes(needle)) ||
    /\.\.\.$/.test(value) ||
    /^<.*>$/.test(value)
  );
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// The URL in the browser address bar (supabase.com/dashboard/project/<ref>) is
// not the API URL. The API lives at https://<ref>.supabase.co.
function dashboardProjectRef(value) {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== 'supabase.com' && parsed.hostname !== 'app.supabase.com') return null;
    return parsed.pathname.match(/\/dashboard\/project\/([a-z0-9]+)/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

function isJwt(value) {
  return /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function jwtRole(value) {
  if (!isJwt(value) || typeof atob !== 'function') return null;
  try {
    const payload = value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(padded))?.role ?? null;
  } catch {
    return null;
  }
}

function looksLikeAnonKey(value) {
  return isJwt(value) || /^sb_publishable_[A-Za-z0-9_-]+$/.test(value);
}

function describeConfigIssue() {
  if (!url && !anonKey) {
    return 'client/.env is missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Copy client/.env.example to client/.env and fill both in.';
  }
  if (!url) {
    return 'VITE_SUPABASE_URL is missing from client/.env. Copy the Project URL from Supabase -> Project Settings -> API.';
  }

  const dashboardRef = dashboardProjectRef(url);
  if (dashboardRef) {
    return `VITE_SUPABASE_URL is the Supabase dashboard page, not the API. Use https://${dashboardRef}.supabase.co (Supabase -> Project Settings -> API -> Project URL).`;
  }

  if (looksLikePlaceholder(url, URL_PLACEHOLDERS)) {
    return `VITE_SUPABASE_URL is still the example value (${url}). Replace it with your real Project URL from Supabase -> Project Settings -> API.`;
  }
  if (!isHttpUrl(url)) {
    return `VITE_SUPABASE_URL is not a valid http(s) URL: ${url}`;
  }
  if (!anonKey) {
    return 'VITE_SUPABASE_ANON_KEY is missing from client/.env. Copy the anon/publishable key from Supabase -> Project Settings -> API.';
  }
  if (looksLikePlaceholder(anonKey, KEY_PLACEHOLDERS)) {
    return 'VITE_SUPABASE_ANON_KEY is still the example value. Replace it with the anon/publishable key from Supabase -> Project Settings -> API.';
  }
  if (/^sb_secret_/i.test(anonKey)) {
    return 'client/.env contains a secret key. Use the anon or publishable key here; the service role secret must stay in server/.env.';
  }
  if (!looksLikeAnonKey(anonKey)) {
    return 'VITE_SUPABASE_ANON_KEY does not look like a Supabase key. It should start with "eyJ" (legacy JWT) or "sb_publishable_".';
  }

  const role = jwtRole(anonKey);
  if (role && role !== 'anon') {
    return `VITE_SUPABASE_ANON_KEY has role "${role}". Use the anon (or publishable) key; the service_role key must stay on the server.`;
  }

  return null;
}

export const supabaseConfigIssue = describeConfigIssue();
export const isSupabaseConfigured = !supabaseConfigIssue;

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
