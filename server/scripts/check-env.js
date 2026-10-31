#!/usr/bin/env node
/**
 * Oopsie environment check.
 *
 * Verifies that every required variable is set, pings Supabase (topics table +
 * leaderboard view), and sends one tiny prompt to the configured LLM.
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

function checkVariable(name, { url = false, secret = false, minLength = 1 } = {}) {
  const value = (process.env[name] ?? '').trim();

  if (!value) {
    return report(name, false, 'missing — copy server/.env.example to server/.env and fill it in');
  }
  if (looksLikePlaceholder(value)) {
    return report(name, false, 'still set to the example placeholder — replace it with your real value');
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

async function main() {
  console.log('\nOopsie environment check');
  console.log(`env file: ${envPath}`);
  console.log(`          ${envExists ? 'found' : 'NOT FOUND — copy server/.env.example to server/.env'}`);

  console.log('\n1) Required variables');
  const supabaseUrlOk = checkVariable('SUPABASE_URL', { url: true });
  const serviceKeyOk = checkVariable('SUPABASE_SERVICE_ROLE_KEY', { secret: true, minLength: 20 });
  const llmUrlOk = checkVariable('LLM_API_URL', { url: true });
  const llmKeyOk = checkVariable('LLM_API_KEY', { secret: true, minLength: 10 });
  const modelOk = checkVariable('LLM_MODEL');

  console.log('\n2) Supabase');
  if (supabaseUrlOk && serviceKeyOk) {
    await pingSupabase(
      (process.env.SUPABASE_URL || '').trim(),
      (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    );
  } else {
    skip('Supabase connection', 'fix the failing Supabase variable(s) above first');
  }

  console.log('\n3) LLM');
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
