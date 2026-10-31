-- ============================================================================
-- Oopsie — initial schema, RLS, leaderboard, and seed topics
-- Run this in the Supabase SQL editor (or with `supabase db push`).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Learner' check (char_length(display_name) between 1 and 40),
  total_points integer not null default 0 check (total_points >= 0),
  created_at   timestamptz not null default now()
);

create table if not exists public.topics (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  category    text not null check (category in ('technical', 'non-technical')),
  description text not null default '',
  icon        text not null default 'sparkles',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  topic_id        uuid references public.topics (id) on delete set null,
  difficulty      text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  type            text not null check (type in ('mcq', 'numeric', 'short_text')),
  prompt          text not null,
  options         jsonb,
  answer_key      text not null,
  rubric          text not null default '',
  solution        text not null default '',
  flaw            jsonb,
  source          text not null default 'generated' check (source in ('generated', 'user')),
  concept_tag     text,
  created_at      timestamptz not null default now()
);

create table if not exists public.mistakes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  question_id    uuid references public.questions (id) on delete set null,
  topic_id       uuid references public.topics (id) on delete set null,
  concept_tag    text not null default 'General',
  misconception  text not null default '',
  user_attempt   text not null default '',
  status         text not null default 'open' check (status in ('open', 'resolved')),
  times_practiced integer not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  question_id uuid references public.questions (id) on delete set null,
  mode        text not null check (mode in ('practice', 'self_study', 'practice_similar', 'spot_flaw')),
  hints_used  integer not null default 0 check (hints_used between 0 and 3),
  points      integer not null default 0 check (points >= 0),
  status      text not null default 'in_progress' check (status in ('in_progress', 'solved', 'revealed')),
  transcript  jsonb not null default '[]'::jsonb,
  mistake_id  uuid references public.mistakes (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.lessons (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.topics (id) on delete cascade,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  content    jsonb not null,
  created_at timestamptz not null default now(),
  unique (topic_id, difficulty)
);

-- ----------------------------------------------------------------------------
-- Indexes & integrity guards
-- ----------------------------------------------------------------------------

create index if not exists attempts_user_created_idx on public.attempts (user_id, created_at desc);
create index if not exists attempts_mistake_idx on public.attempts (mistake_id);
create index if not exists attempts_question_idx on public.attempts (question_id);
create index if not exists mistakes_user_created_idx on public.mistakes (user_id, created_at desc);
create index if not exists questions_topic_idx on public.questions (topic_id, difficulty);

-- A user can only earn points once for a given question.
create unique index if not exists attempts_one_award_per_question
  on public.attempts (user_id, question_id)
  where points > 0;

-- Don't allow the same saved mistake twice for one question.
create unique index if not exists mistakes_one_per_question
  on public.mistakes (user_id, question_id)
  where question_id is not null;

-- ----------------------------------------------------------------------------
-- Profile bootstrap
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dn text;
begin
  dn := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Learner'
  );

  insert into public.profiles (id, display_name)
  values (new.id, left(dn, 40))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Server-only points mutation (uses the service role).
create or replace function public.add_points(p_user uuid, p_points integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set total_points = total_points + greatest(p_points, 0)
   where id = p_user;
$$;

revoke all on function public.add_points(uuid, integer) from public, anon, authenticated;
grant execute on function public.add_points(uuid, integer) to service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.profiles  enable row level security;
alter table public.topics    enable row level security;
alter table public.questions enable row level security;
alter table public.mistakes  enable row level security;
alter table public.attempts  enable row level security;
alter table public.lessons   enable row level security;

-- Profiles: read/update your own row. Points are server-write only.
drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

-- Topics & lessons: readable by signed-in learners.
drop policy if exists "topics read" on public.topics;
create policy "topics read" on public.topics for select to authenticated using (true);

drop policy if exists "lessons read" on public.lessons;
create policy "lessons read" on public.lessons for select to authenticated using (true);

-- Attempts & mistakes: readable only by their owner. All writes go through the
-- API server (service role), which validates ownership and scoring.
drop policy if exists "attempts read own" on public.attempts;
create policy "attempts read own" on public.attempts
  for select using (auth.uid() = user_id);

drop policy if exists "mistakes read own" on public.mistakes;
create policy "mistakes read own" on public.mistakes
  for select using (auth.uid() = user_id);

-- No client policies for questions: answer keys and solutions stay server-side.

-- ----------------------------------------------------------------------------
-- Privileges (least surprise on Supabase's broad default grants)
-- ----------------------------------------------------------------------------

revoke all on public.profiles  from anon, authenticated;
grant  select on public.profiles to authenticated;
grant  update (display_name) on public.profiles to authenticated;
grant  insert (id, display_name) on public.profiles to authenticated;

revoke all on public.topics from anon, authenticated;
grant  select on public.topics to authenticated;

revoke all on public.lessons from anon, authenticated;
grant  select on public.lessons to authenticated;

revoke all on public.questions from anon, authenticated;

revoke all on public.attempts from anon, authenticated;
grant  select on public.attempts to authenticated;

revoke all on public.mistakes from anon, authenticated;
grant  select on public.mistakes to authenticated;

-- ----------------------------------------------------------------------------
-- Leaderboard view — only rank, display name and points are exposed.
-- ----------------------------------------------------------------------------

create or replace view public.leaderboard as
select
  p.id                                                            as user_id,
  p.display_name,
  p.total_points                                                  as points,
  rank() over (order by p.total_points desc, p.display_name asc)   as rank
from public.profiles p;

revoke all on public.leaderboard from anon, authenticated;
grant  select (rank, display_name, points) on public.leaderboard to authenticated;

-- ----------------------------------------------------------------------------
-- Seed topics
-- ----------------------------------------------------------------------------

insert into public.topics (slug, name, category, description, icon, sort_order) values
  ('dsa', 'Data Structures & Algorithms', 'technical',
   'Arrays, trees, graphs, and the patterns that unlock them.', 'binary', 1),
  ('sql', 'SQL & Databases', 'technical',
   'Query, join, aggregate, and reason about data.', 'database', 2),
  ('python', 'Python Programming', 'technical',
   'Readable code, core libraries, and problem solving.', 'code', 3),
  ('aptitude', 'Aptitude & Quant', 'technical',
   'Percentages, ratios, speed, and number sense.', 'calculator', 4),
  ('networking', 'Networking', 'technical',
   'Packets, protocols, DNS, and how the internet moves.', 'network', 5),
  ('general-science', 'General Science', 'non-technical',
   'Physics, chemistry, biology, and how the world works.', 'atom', 6),
  ('logical-reasoning', 'Logical Reasoning', 'non-technical',
   'Patterns, deductions, and clean arguments.', 'puzzle', 7),
  ('english-grammar', 'English Grammar', 'non-technical',
   'Clarity, punctuation, and confident sentences.', 'book-open', 8),
  ('personal-finance', 'Personal Finance', 'non-technical',
   'Budgets, interest, risk, and money decisions.', 'wallet', 9),
  ('world-history', 'World History', 'non-technical',
   'Turning points, causes, and consequences.', 'landmark', 10),
  ('nutrition', 'Nutrition & Health', 'non-technical',
   'Macros, micronutrients, and evidence-based habits.', 'apple', 11),
  ('astronomy', 'Astronomy & Space', 'non-technical',
   'Planets, stars, galaxies, and the scale of it all.', 'rocket', 12)
on conflict (slug) do update set
  name        = excluded.name,
  category    = excluded.category,
  description = excluded.description,
  icon        = excluded.icon,
  sort_order  = excluded.sort_order;
