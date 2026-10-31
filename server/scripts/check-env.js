#!/usr/bin/env node
/**
 * Oopsie environment check.
 *
 * Verifies that every required variable is set, checks the client's Supabase
 * config, pings Supabase (topics table + leaderboard view), confirms Google is
 * enabled, and sends one tiny prompt to the configured LLM.
 *
 * Usage (from the repo root):   npm run check
 * Usage (from server/):         npm run check
 * Direct:                       node server/scripts/check-env.js
 *
 * Secrets are never printed. The script exits 0 only when every check passes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(scriptDir, '..');
const envPath = path.join(serverDir, '.env');
const envExists = fs.existsSync(envPath);

const clientEnvPath = path.resolve(serverDir, '..', 'client', '.env');
const clientEnvExists = fs.existsSync(clientEnvPath);
const clientEnv = readEnvFile(clientEnvPath);

dotenv.config({ path: envPath });

const checks = [];
const line = '-'.repeat(64);

function report(name, ok, detail) {
  checks.push({ name, ok });
  const badge = ok ? 'OK  ' : 'FAIL';
  console.log(`  ${badge}  ${name}`);
  if (detail) console.log(`        ${redact(detail)}`);
  return ok;
}

function skip(name, detail) {
  console.log(`  SKIP  ${name}`);
  if (detail) console.log(`        ${redact(detail)}`);
}

const PLACEHOLDERS = [
  'your-project.supabase.co',
  'sb_secret_...',
  'eyJhbGciOi...',
  'sk-...',
  'gsk_...',
  'changeme',
  '<your',
];

function looksLikePlaceholder(value) {
  const lower = value.toLowerCase();
  return PLACEHOLDERS.some((needle) => lower.includes(needle.toLowerCase()));
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// Show origin + path only, so credentials in a query string never get printed.
function displayUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '(unparseable URL)';
  }
}

function readEnvFile(file) {
  try {
    return dotenv.parse(fs.readFileSync(file));
  } catch {
    return {};
  }
}

// The dashboard URL (supabase.com/dashboard/project/<ref>) is a common
// copy/paste mistake; it is not the API endpoint.
function dashboardProjectRef(value) {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== 'supabase.com' && parsed.hostname !== 'app.supabase.com') return null;
    return parsed.pathname.match(/\/dashboard\/project\/([a-z0-9]+)/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

function looksLikeAnonKey(value) {
  return (
    /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) ||
    /^sb_publishable_[A-Za-z0-9_-]+$/.test(value)
  );
}

function jwtRole(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))?.role ?? null;
  } catch {
    return null;
  }
}

function checkVariable(name, { url = false, secret = false, minLength = 1 } = {}) {
  const value = (process.env[name] ?? '').trim();

  if (!value) {
    return report(name, false, 'missing — copy server/.env.example to server/.env and fill it in');
  }
  if (looksLikePlaceholder(value)) {
    return report(name, false, 'still set to the example placeholder — replace it with your real value');
  }
  if (url) {
    const ref = dashboardProjectRef(value);
    if (ref) {
      return report(name, false, `this is the Supabase dashboard URL - use https://${ref}.supabase.co instead`);
    }
  }
  if (url && !isHttpUrl(value)) {
    return report(name, false, `not a valid http(s) URL: ${value}`);
  }
  if (minLength > 1 && value.length < minLength) {
    return report(name, false, `too short (${value.length} chars) — does not look like a real key`);
  }

  const detail = secret ? `set (${value.length} chars, hidden)` : url ? displayUrl(value) : value;
  return report(name, true, detail);
}

// Remove anything that looks like a credential before printing third-party text.
function redact(text) {
  return String(text || '')
    .replace(/\b(?:sk|gsk|xai|pplx|hf|api)[-_][A-Za-z0-9_*.-]{8,}/gi, '[redacted key]')
    .replace(/\beyJ[A-Za-z0-9_*.-]{10,}/g, '[redacted token]')
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_*.-]{6,}/gi, '[redacted key]');
}

function brief(text, limit = 300) {
  const clean = redact(text).replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit)}...` : clean;
}

function providerMessage(bodyText) {
  try {
    const parsed = JSON.parse(bodyText);
    const message = parsed?.error?.message || parsed?.message || parsed?.error;
    if (typeof message === 'string') return brief(message);
  } catch {
    /* fall through */
  }
  return brief(bodyText);
}

// Spot the common "right key, wrong endpoint" mix-up without printing the key.
function keyEndpointHint(url, key) {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (key.startsWith('gsk_') && host.endsWith('openai.com')) {
    return 'this looks like a Groq key, but LLM_API_URL points at OpenAI — use https://api.groq.com/openai/v1/chat/completions';
  }
  if (key.startsWith('sk-') && /groq\.com$/.test(host)) {
    return 'this looks like an OpenAI key, but LLM_API_URL points at Groq — check that the URL matches the key';
  }
  if (key.startsWith('gsk_') && !/groq\.com$/.test(host)) {
    return 'this looks like a Groq key, but LLM_API_URL is not a Groq endpoint';
  }
  return null;
}

async function pingSupabase(url, key) {
  let client;
  try {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-application-name': 'oopsie-check-env' } },
    });
  } catch (error) {
    return report('Supabase connection', false, `could not create a client: ${error.message}`);
  }

  let topics;
  try {
    // A normal GET (not head:true) so PostgREST errors, such as a missing
    // table, are surfaced instead of being reported as an empty result.
    topics = await client.from('topics').select('id', { count: 'exact' }).limit(1);
  } catch (error) {
    const cause = error?.cause?.code || error?.cause?.message;
    return report('Supabase connection', false, brief(cause || error?.message || error));
  }

  if (topics.error) {
    const message = topics.error.message || String(topics.error);
    let reason = message;

    if (/does not exist|schema cache|could not find the table|not find the relation/i.test(message)) {
      reason += ' — run supabase/setup.sql in the Supabase SQL editor';
    } else if (/invalid api key|jwt|401|403|permission|unauthorized/i.test(message)) {
      reason += ' — check SUPABASE_SERVICE_ROLE_KEY (use the service_role/secret key, not anon)';
    } else if (/fetch failed|enotfound|econnrefused|getaddrinfo|network/i.test(message)) {
      reason += ' — check SUPABASE_URL and your network connection';
    }

    return report('Supabase connection', false, brief(reason));
  }

  const count = topics.count ?? 0;
  if (count === 0) {
    return report('Supabase connection', false, 'connected, but the topics table is empty — run supabase/setup.sql');
  }

  const leaderboard = await client.from('leaderboard').select('rank, display_name, points').limit(1);
  if (leaderboard.error) {
    const message = leaderboard.error.message || String(leaderboard.error);
    const reason = /does not exist|schema cache|could not find the table|not find the relation/i.test(message)
      ? `${message} — run supabase/setup.sql to create the leaderboard view`
      : message;
    return report('Supabase connection', false, brief(reason));
  }

  const topicNote = count === 12 ? '12 topics' : `${count} topics (expected 12)`;
  return report(
    'Supabase connection',
    true,
    `connected; topics table reachable (${topicNote}); leaderboard view reachable`,
  );
}

async function pingLlm(url, key, model) {
  const started = Date.now();

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: 'This is a connectivity test. Reply with the single word: OK',
          },
        ],
        temperature: 0,
        max_tokens: 128,
        stream: false,
      }),
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    const code = error?.cause?.code || error?.cause?.message || error?.message || String(error);
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return report('LLM connection', false, 'timed out after 25s — check LLM_API_URL or try again');
    }
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNREFUSED') {
      return report('LLM connection', false, `could not reach the provider (${code}) — check LLM_API_URL`);
    }
    return report('LLM connection', false, brief(code));
  }

  const bodyText = await response.text().catch(() => '');

  if (!response.ok) {
    let reason = `provider returned HTTP ${response.status}`;

    if (response.status === 401 || response.status === 403) {
      // Never echo the provider body here: it often repeats part of the key.
      const hint = keyEndpointHint(url, key);
      return report('LLM connection', false, `the provider rejected the credentials — check LLM_API_KEY${hint ? `; ${hint}` : ''}`);
    }
    if (response.status === 404) {
      reason += ' — check LLM_API_URL and LLM_MODEL';
    } else if (response.status === 429) {
      reason += ' — rate limited; wait a minute and try again';
    } else if (response.status === 400 || response.status === 422) {
      reason += ' — the provider rejected the request; check LLM_MODEL';
    }

    const detail = providerMessage(bodyText);
    return report('LLM connection', false, `${reason}${detail ? ` — ${detail}` : ''}`);
  }

  let payload = null;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return report('LLM connection', false, 'provider replied HTTP 200 but the body was not JSON');
  }

  const content = payload?.choices?.[0]?.message?.content;
  const reply = typeof content === 'string' ? content.trim() : '';
  const elapsed = Date.now() - started;

  return report(
    'LLM connection',
    true,
    `${model} responded in ${elapsed} ms${reply ? ` — "${brief(reply, 60)}"` : ' (HTTP 200, empty content)'}`,
  );
}

// The browser app signs in with these values. Google OAuth is built from them,
// so a placeholder URL or key makes "Continue with Google" fail before Supabase
// is ever reached.
function checkClientEnv() {
  console.log(`   env file: ${clientEnvPath}`);
  console.log(`             ${clientEnvExists ? 'found' : 'NOT FOUND - copy client/.env.example to client/.env'}`);

  const pick = (key) => {
    if (process.env[key] !== undefined) return process.env[key].trim();
    return (clientEnv[key] || '').trim();
  };
  const rawUrl = pick('VITE_SUPABASE_URL');
  const rawKey = pick('VITE_SUPABASE_ANON_KEY');
  const apiUrl = pick('VITE_API_URL');

  let urlOk = false;
  let keyOk = false;

  if (!rawUrl) {
    report('VITE_SUPABASE_URL', false, 'missing - copy client/.env.example to client/.env and fill it in');
  } else if (dashboardProjectRef(rawUrl)) {
    report(
      'VITE_SUPABASE_URL',
      false,
      `this is the Supabase dashboard URL, not the API - use https://${dashboardProjectRef(rawUrl)}.supabase.co`,
    );
  } else if (looksLikePlaceholder(rawUrl)) {
    report(
      'VITE_SUPABASE_URL',
      false,
      'still set to the example placeholder - replace it with your real Project URL (Supabase -> Project Settings -> API)',
    );
  } else if (!isHttpUrl(rawUrl)) {
    report('VITE_SUPABASE_URL', false, `not a valid http(s) URL: ${rawUrl}`);
  } else {
    urlOk = report('VITE_SUPABASE_URL', true, displayUrl(rawUrl));
  }

  if (!rawKey) {
    report('VITE_SUPABASE_ANON_KEY', false, 'missing - copy client/.env.example to client/.env and fill it in');
  } else if (looksLikePlaceholder(rawKey)) {
    report(
      'VITE_SUPABASE_ANON_KEY',
      false,
      'still set to the example placeholder - replace it with the anon/publishable key',
    );
  } else if (/^sb_secret_/i.test(rawKey)) {
    report(
      'VITE_SUPABASE_ANON_KEY',
      false,
      'this is a secret/service key - never put it in client/.env; use the anon or publishable key',
    );
  } else if (!looksLikeAnonKey(rawKey)) {
    report(
      'VITE_SUPABASE_ANON_KEY',
      false,
      'does not look like a Supabase anon key (expected "eyJ..." or "sb_publishable_...")',
    );
  } else {
    const role = jwtRole(rawKey);
    if (role && role !== 'anon') {
      report(
        'VITE_SUPABASE_ANON_KEY',
        false,
        `has role "${role}" - use the anon/publishable key, not the service_role key`,
      );
    } else {
      keyOk = report('VITE_SUPABASE_ANON_KEY', true, `set (${rawKey.length} chars, hidden)`);
    }
  }

  if (!apiUrl) {
    report('VITE_API_URL', true, 'empty - the Vite dev proxy sends /api to http://localhost:8787');
  } else if (!isHttpUrl(apiUrl)) {
    report('VITE_API_URL', false, `not a valid http(s) URL: ${apiUrl}`);
  } else {
    report('VITE_API_URL', true, displayUrl(apiUrl));
  }

  // The client signs in with one project; the server verifies tokens with
  // another if these differ, so every API call would return 401.
  if (urlOk) {
    const serverUrl = (process.env.SUPABASE_URL || '').trim();
    if (isHttpUrl(serverUrl)) {
      try {
        const same = new URL(serverUrl).hostname === new URL(rawUrl).hostname;
        report(
          'Client and server use the same Supabase project',
          same,
          same ? 'yes' : 'they point at different projects - sign-in succeeds but every API call returns 401',
        );
      } catch {
        /* the server URL was already reported above */
      }
    }
  }

  return { urlOk, keyOk, url: rawUrl, key: rawKey };
}

async function pingGoogleProvider(url, anonKey) {
  const endpoint = `${url.replace(/\/+$/, '')}/auth/v1/settings`;

  let response;
  try {
    response = await fetch(endpoint, {
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const code = error?.cause?.code || error?.cause?.message || error?.message || String(error);
    return report(
      'Google provider',
      false,
      `could not read auth settings (${brief(code)}) - check VITE_SUPABASE_URL and your connection`,
    );
  }

  if (!response.ok) {
    return report(
      'Google provider',
      false,
      `could not read auth settings (HTTP ${response.status}) - check VITE_SUPABASE_ANON_KEY`,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return report('Google provider', false, 'auth settings response was not JSON');
  }

  const enabled = data?.external?.google === true;
  return report(
    'Google provider',
    enabled,
    enabled
      ? 'enabled in Supabase'
      : 'disabled - Supabase -> Authentication -> Sign In / Providers -> Google: enable it and add your Client ID + Secret',
  );
}

async function main() {
  console.log('\nOopsie environment check');
  console.log(`server env: ${envPath}`);
  console.log(`            ${envExists ? 'found' : 'NOT FOUND - copy server/.env.example to server/.env'}`);
  console.log(`client env: ${clientEnvPath}`);
  console.log(`            ${clientEnvExists ? 'found' : 'NOT FOUND - copy client/.env.example to client/.env'}`);

  console.log('\n1) Server variables');
  const supabaseUrlOk = checkVariable('SUPABASE_URL', { url: true });
  const serviceKeyOk = checkVariable('SUPABASE_SERVICE_ROLE_KEY', { secret: true, minLength: 20 });
  const llmUrlOk = checkVariable('LLM_API_URL', { url: true });
  const llmKeyOk = checkVariable('LLM_API_KEY', { secret: true, minLength: 10 });
  const modelOk = checkVariable('LLM_MODEL');

  console.log('\n2) Client variables (Google sign-in)');
  const client = checkClientEnv();

  console.log('\n3) Supabase database');
  if (supabaseUrlOk && serviceKeyOk) {
    await pingSupabase(
      (process.env.SUPABASE_URL || '').trim(),
      (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    );
  } else {
    skip('Supabase connection', 'fix the failing Supabase variable(s) above first');
  }

  console.log('\n4) Google sign-in');
  if (client.urlOk && client.keyOk) {
    await pingGoogleProvider(client.url, client.key);
  } else {
    skip('Google provider', 'fix the failing client variable(s) above first');
  }

  console.log('\n5) LLM');
  if (llmUrlOk && llmKeyOk && modelOk) {
    await pingLlm(
      (process.env.LLM_API_URL || '').trim(),
      (process.env.LLM_API_KEY || '').trim(),
      (process.env.LLM_MODEL || '').trim(),
    );
  } else {
    skip('LLM connection', 'fix the failing LLM variable(s) above first');
  }

  const failed = checks.filter((check) => !check.ok);
  console.log(`\n${line}`);
  if (!failed.length) {
    console.log('All checks passed. Start the app with: npm run dev\n');
    return;
  }
  console.log(`${failed.length} check(s) failed: ${failed.map((check) => check.name).join(', ')}`);
  console.log('Fix the FAIL lines above, then run this again.\n');
  process.exitCode = 1;
}

main().catch((error) => {
  console.error('\nUnexpected error while checking the environment:', redact(error?.message || error));
  process.exitCode = 1;
});
