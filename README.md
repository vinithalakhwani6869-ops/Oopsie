# Oopsie

**An AI learning coach that never hands out the answer first.**

Oopsie is built around one rule: you attempt the question before you get help. A wrong attempt unlocks one of three progressive hints. A wrong attempt after the third hint reveals a worked solution. Points go down as hints go up.

Most AI study tools answer for you. Oopsie coaches the mistake instead.

---

## Quick start

```bash
npm run setup                 # install root + server + client deps
# create server/.env and client/.env from the .env.example files
# paste supabase/setup.sql into the Supabase SQL editor and run it
npm run check                 # verify env vars, Supabase, and the LLM
npm run seed -- --fallback-only
npm run dev                   # API :8787 + client :5173
```

Then open <http://localhost:5173>.

> There is no `npm start` script. Use `npm run dev` for local development.

---

## What's inside

- **Hint Ladder** — 0 hints = 3 points, 1 hint = 2, 2 hints = 1, 3 hints = 0. A wrong answer after the third hint reveals the full solution.
- **Practice mode** — MCQ, numeric, and short-answer questions across 12 topics and 3 difficulty levels.
- **Study mode** — an AI lesson per topic/difficulty, plus curated resource links from a local seed file (no scraping at runtime). Skip straight to the questions whenever you want.
- **Self-study** — paste your own question. The AI solves it privately, coaches you through the ladder, and never pays points.
- **Mistakes** — every revealed session can be saved with its concept and misconception. Train it with fresh **similar practice** or **Spot the Flaw**, a worked argument with one deliberate error.
- **Leaderboard** — global points view with a **30-point daily cap** (configurable). Self-study never scores.
- **Stats** — accuracy, current/longest streak, 365-day heatmap, and per-topic mastery with an expandable **"Why this score?"** breakdown showing every weighted input.
- **Real auth** — Supabase email/password and Google OAuth, RLS on every table, and a server-only service role.
- **AI with guardrails** — strict JSON validated by Zod, one retry on invalid JSON, a hint leak detector, and graceful fallbacks when the LLM is down.

---

## Stack

| Layer | Choice |
| --- | --- |
| Client | React 18, Vite, TailwindCSS, React Router, lucide-react |
| Server | Node.js, Express, Zod, Supabase JS |
| Database | Supabase Postgres with RLS, a `leaderboard` view, and an `add_points` RPC |
| Auth | Supabase Auth (Google OAuth + email/password) |
| AI | Any OpenAI-compatible `/chat/completions` endpoint (defaults to Groq) |

The LLM is only ever called from `server/llm.js`. The browser never sees its key.

---

## Project structure

```text
Oopsie/
├── client/                     React app
│   ├── src/
│   │   ├── components/         Layout, UI primitives, ladder, heatmap, mastery
│   │   ├── context/            AuthContext
│   │   ├── lib/                API client, Supabase client, formatting
│   │   └── pages/              Topics, topic/study, practice, mistakes, stats…
│   └── .env.example
├── server/                     Express API
│   ├── engine/                 Pure ladder + stats logic (unit tested)
│   ├── routes/                 me, topics, practice, attempts, mistakes…
│   ├── scripts/
│   │   ├── check-env.js        Environment + connectivity checker
│   │   └── seed.js             Topic questions + lessons
│   ├── seed/                   Curated resources + offline fallback questions
│   ├── test/                   Node test-runner tests
│   ├── game.js                 Sessions, grading, scoring, mistake resolution
│   ├── llm.js                  Provider wrapper, JSON validation/retry
│   └── .env.example
├── supabase/
│   ├── setup.sql               Complete, idempotent database setup
│   └── migrations/001_init.sql Original migration
└── package.json                Root scripts
```

---

## Setup

### 0. Prerequisites

- Node.js 20 or newer
- A Supabase project
- An API key for an OpenAI-compatible chat model (Groq by default; OpenAI, OpenRouter, Together, etc. also work)

### 1. Install dependencies

From the project root:

```bash
npm run setup
```

This installs the root, server, and client dependencies.

### 2. Create the database

Open your Supabase project → **SQL Editor** → **New query**, paste the entire contents of:

```text
supabase/setup.sql
```

Run it. It is **safe to run more than once**: tables use `IF NOT EXISTS`, policies are dropped before being recreated, and views/functions use `CREATE OR REPLACE`.

It creates:

- `profiles`, `topics`, `questions`, `attempts`, `mistakes`, `lessons`
- indexes and one-points-award-per-question guards
- the profile bootstrap trigger for new auth users
- the server-only `add_points` RPC
- RLS policies and least-privilege column grants
- the `leaderboard` view (exposes only `rank`, `display_name`, `points`)
- 12 seeded topics across technical and non-technical categories

> If you use the Supabase CLI, `supabase db push` still works with `supabase/migrations/001_init.sql`.

### 3. Configure authentication

**Email/password:** in Supabase → **Authentication → Providers**, enable Email. Decide whether email confirmation is required. For quick local testing you can turn confirmation off; otherwise confirm the signup email before signing in.

**Google OAuth:** in Supabase → **Authentication → Providers → Google**, add your Google OAuth client ID and secret from Google Cloud Console.

Add these URLs in Supabase → **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173`
- **Redirect URLs:**
  - `http://localhost:5173/auth/callback`
  - your production client URL + `/auth/callback`

In Google Cloud Console, the authorized redirect URI is the Supabase callback:

```text
https://<your-project-ref>.supabase.co/auth/v1/callback
```

### 4. Environment variables

Copy the examples and fill them in:

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

**`server/.env`** (never expose this file or its service key to the browser):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

LLM_API_URL=https://api.groq.com/openai/v1/chat/completions
LLM_API_KEY=your-groq-key
LLM_MODEL=openai/gpt-oss-120b
```

**`client/.env`** (public values only):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=
```

Leave `VITE_API_URL` empty during local development to use the Vite proxy at `/api`.

**Required variables**

| Variable | Where | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | server | Supabase project URL. Must match the client. |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Server writes and scoring. **Never** put this in the client. |
| `LLM_API_URL` | server | Full chat-completions URL. |
| `LLM_API_KEY` | server | Provider key. |
| `LLM_MODEL` | server | Model name understood by your provider. |
| `VITE_SUPABASE_URL` | client | Same project URL. |
| `VITE_SUPABASE_ANON_KEY` | client | Public anon/publishable key; RLS still applies. |
| `VITE_API_URL` | client | API base URL. Empty = Vite proxy (`/api`). |

**Optional server variables**

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | API port. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins. Localhost is always allowed. |
| `DAILY_POINT_CAP` | `30` | Practice points allowed per UTC day. |
| `LLM_DISABLE_JSON_MODE` | unset | Set to `true` if your provider rejects `response_format`. |
| `LLM_TIMEOUT_MS` | `60000` | Provider request timeout. |

`server/.env` and `client/.env` are ignored by git (`.gitignore` contains `.env` and `.env.local`). The `.env.example` files are intentionally tracked.

### 5. Check your environment

```bash
npm run check
```

The checker reads `server/.env` and prints `OK` / `FAIL` / `SKIP` for each item:

1. **Variables** — presence, placeholder detection, URL shape, and plausible key length. Secrets are shown only as `set (N chars, hidden)`.
2. **Supabase** — connects with the service key, confirms the `topics` table and `leaderboard` view exist, and reports the topic count.
3. **LLM** — sends one tiny prompt and reports the response time or a clear reason for failure (bad key, wrong URL/model, rate limit, timeout, DNS).

It exits `0` only when everything passes. If variables are missing or still placeholders, network checks are skipped, so it never calls a provider with fake credentials.

### 6. Seed questions

The database setup seeds topics, not questions. Generate them:

```bash
npm run seed
```

Useful options:

```bash
npm run seed -- --fallback-only          # no LLM calls; one offline question per topic
npm run seed -- --topic=sql              # one topic
npm run seed -- --difficulty=beginner    # one difficulty
npm run seed -- --count=3                # questions per topic/difficulty
npm run seed -- --lessons                # pre-generate study lessons too
npm run seed -- --force                  # add more even if questions exist
```

If the LLM fails, the script falls back to the offline question bank in `server/seed/fallbackQuestions.js`, so every topic always has at least one question.

### 7. Run it

```bash
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:8787>
- Health: <http://localhost:8787/api/health>

Vite proxies `/api` to the server, so `VITE_API_URL` can stay empty during local development.

### 8. Verify

```bash
npm run check   # env, Supabase, LLM
npm test        # pure ladder + stats unit tests
npm run build   # production client build
```

---

## How the Hint Ladder works

| Hints used | Correct answer | Wrong answer |
| --- | --- | --- |
| 0 | **3 points**, session solved | Hint 1 unlocks |
| 1 | **2 points**, session solved | Hint 2 unlocks |
| 2 | **1 point**, session solved | Hint 3 unlocks |
| 3 | **0 points**, session solved | Worked solution revealed |

- Hints are generated from the **actual mistake**, the question's rubric, and the previous hint(s).
- Hint 1 is a conceptual nudge, hint 2 points at where reasoning diverged, hint 3 describes the next move.
- A server-side leak guard checks every hint against the answer key (including multi-digit numbers). If it leaks, the server regenerates once, then uses a safe templated hint.
- `answer_key` and `solution` are stripped from every response while the attempt is `in_progress`. They are only returned when the status is `solved` or `revealed`.
- A wrong attempt after hint 3 reveals the solution and ends the round at 0 points.

**Practice points** apply to `practice`, `practice_similar`, and `spot_flaw` up to the daily cap. `self_study` always pays 0. Points reset at **midnight UTC**.

**Mistake resolution:** a saved mistake resolves after **2 solved `practice_similar` attempts with ≤ 1 hint**. Spot the Flaw is unscored but trains the same misconception; its sessions still count toward streaks and stats.

---

## API overview

All routes below are mounted under `/api`, require a Supabase bearer token, and are rate-limited.

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/health` | Public config/health check |
| `GET` / `PATCH` | `/me` | Profile, email, global rank / change display name |
| `GET` | `/topics` | Topics, question counts, curated resources |
| `GET` | `/topics/:slug` | Topic detail + per-difficulty counts |
| `GET` | `/topics/:slug/lesson?difficulty=` | Cached AI study lesson (generates on first request) |
| `POST` | `/practice/start` | Start a practice attempt |
| `GET` | `/attempts/:id` | Attempt payload (the client only sees answer/solution when finished) |
| `POST` | `/attempts/:id/submit` | Submit an answer |
| `POST` | `/attempts/:id/submit-flaw` | Submit a Spot the Flaw diagnosis |
| `POST` | `/self-study/start` | AI solve + private ladder session |
| `GET` | `/mistakes` | Mistake bank + resolution progress |
| `GET` / `PATCH` | `/mistakes/:id` | Detail / mark open or resolved |
| `POST` | `/mistakes/:id/practice` | Generate a similar question |
| `POST` | `/mistakes/:id/spot-flaw` | Generate a flawed worked argument |
| `GET` | `/leaderboard` | Top 100, your row, player count, daily cap |
| `GET` | `/stats` | Summary, mistakes, heatmap, per-topic mastery |

See `server/routes/` for exact payloads.

---

## Data and security model

- The browser talks to Supabase Auth directly only for sign-in. All app data goes through the Express API.
- The API verifies the caller's Supabase JWT on every request, then uses the service role for ownership-checked reads and writes.
- RLS blocks client access to `questions` entirely and limits attempts/mistakes to their owner.
- `profiles` grants allow only `display_name` updates from the client; `total_points` is mutated only by the server's `add_points` RPC.
- The leaderboard view exposes `rank`, `display_name`, and `points` — not user IDs or emails. The server marks the caller's own row with `is_me`.
- One points award per question is enforced by a partial unique index. Re-solving a question can still be practiced, but pays 0.
- Zod validates every request body and every LLM JSON response. LLM responses are retried once, then replaced with safe fallbacks where possible.
- Generic Express and AI-specific rate limits protect costly endpoints.
- Request bodies are capped at 64 KB.
- `answer_key` and `solution` never leave the server before a session is finished.

---

## Stats formulas

**Streak:** consecutive UTC days with at least one attempt. Today counts if active; otherwise the streak can continue from yesterday. Longest streak is the longest historical run.

**Heatmap:** 365 UTC days, one square per day. Levels: 0, 1–2, 3–4, 5–6, 7+ sessions.

**Topic mastery (0–100):** take the last 10 scored, non-self-study attempts for that topic. Each attempt has ratio `points ÷ 3` and a recency weight (oldest = 1, newest = highest). Then:

```text
score = Σ(ratio × weight) ÷ Σ(weight) × 100
```

The Stats page shows the weighted sum, weight total, and every attempt's points, hints, weight, and contribution.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run setup` | Install root, server, and client dependencies |
| `npm run dev` | Run server and client together |
| `npm run dev:server` | Server only (nodemon, port 8787) |
| `npm run dev:client` | Client only (Vite, port 5173) |
| `npm run check` | Verify env vars, ping Supabase, and test the LLM |
| `npm run build` | Production client build |
| `npm run seed` | Seed questions/lessons (see options above) |
| `npm test` | Server unit tests for ladder, scoring, leak guard, stats |

Server-specific commands also work via `npm --prefix server run <script>`: `dev`, `start` (`node index.js`), `check`, `seed`, `test`.

---

## Troubleshooting

**`npm error Missing script: "start"`.** There is no root `start` script. Use `npm run dev` (or `npm --prefix server start` for the API alone).

**"The client needs Supabase credentials."** `client/.env` is missing or not loaded. Recreate it from `.env.example` and restart Vite.

**"Could not reach the Oopsie server. Is it running on port 8787?"** Start both with `npm run dev`, or check that `VITE_API_URL` points at the API. If you open the production build directly, set an absolute API URL.

**`npm run check` fails on Supabase with "Could not find the table".** Run `supabase/setup.sql` in the Supabase SQL editor. The checker points at this explicitly.

**`npm run check` says the key was rejected.** Confirm `LLM_API_KEY` and that `LLM_API_URL` matches the provider. A Groq key (`gsk_...`) needs the Groq URL; an OpenAI key (`sk-...`) needs the OpenAI URL. The checker calls out this mismatch.

**`npm run check` says "still set to the example placeholder".** You copied `.env.example` but did not replace that value.

**401 / signed out immediately.** The Supabase session expired or `SUPABASE_URL` / anon key mismatch. Sign in again. Confirm the server's `SUPABASE_URL` points at the same project.

**Signup works but no profile row.** Re-run `supabase/setup.sql` so the `handle_new_user` trigger exists. The API also creates a missing profile lazily on `GET /me`.

**Google sign-in returns to the wrong page.** Add `http://localhost:5173/auth/callback` to Supabase redirect URLs and set the Site URL to `http://localhost:5173`.

**Empty topics.** Run `npm run seed -- --fallback-only` for a question per topic, then `npm run seed` to generate more.

**LLM errors / invalid JSON.** Check `LLM_API_URL`, key, and model name. If your provider rejects JSON mode, set `LLM_DISABLE_JSON_MODE=true`. Hints and MCQ/numeric grading fall back when the provider is unavailable; short-answer grading needs the LLM.

**Points aren't increasing.** You may have hit the daily cap, already earned points for that question, used all three hints (0 points), or the session is self-study. The result panel explains which case applied.

**Seed says "No topics found".** Run `supabase/setup.sql` first.

**`EADDRINUSE` on 8787 or 5173.** Another process owns the port. Stop it, or change `PORT` / run Vite with `--port`.

---

## Design notes / limits

- AI-generated questions and lessons can be wrong. They are validated for shape, not factual truth. Verify anything consequential.
- Generated questions accumulate in the database. There is no automatic cleanup or dedupe beyond the seed script's "avoid recent prompts" list.
- The leaderboard is global and lifetime-based, not seasonal.
- The app is optimized for one learner per browser session; there is no admin UI.
- Offline fallback questions are deliberately few — they guarantee the app is usable, not that it has a full question bank.

---

Built as a full-stack exercise in **productive struggle**: help should arrive one step at a time, and the answer should be the last thing you see.
