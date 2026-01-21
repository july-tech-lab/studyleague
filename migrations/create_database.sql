-- ============================================================
-- 1. PROFILES (Identity + Gamification + Goals)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  -- Public identity
  username text,
  avatar_url text,

  -- Gamification
  xp_total bigint default 0,
  level int default 1,
  current_streak int default 0,
  longest_streak int default 0,

  -- Goals
  weekly_goal_minutes int default 1200,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint username_len check (char_length(username) >= 3)
);

alter table profiles enable row level security;

create policy "Profiles are public"
  on profiles for select using (true);

create policy "Update own profile"
  on profiles for update using (auth.uid() = id);

-- ============================================================
-- 2. SUBJECTS
-- ============================================================
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  icon text,
  color text,

  owner_id uuid references public.profiles(id) on delete cascade,
  parent_subject_id uuid references public.subjects(id) on delete set null,

  created_at timestamptz default now(),
  is_active boolean default true
);

alter table subjects enable row level security;

create policy "Read all subjects"
  on subjects for select using (true);

create policy "User creates personal subjects"
  on subjects for insert with check (auth.uid() = owner_id);

-- DEFAULT GLOBAL SUBJECTS
insert into subjects (name, slug, icon, color) values
('Programmation', 'programming', 'terminal', '#4CAF50'),
('Mathématiques', 'math', 'calculator', '#FF5252'),
('Physique', 'physics', 'atom', '#2196F3'),
('Anglais', 'english', 'book', '#FFC107'),
('Histoire', 'history', 'landmark', '#8D6E63');

-- ============================================================
-- 3. STUDY SESSIONS
-- ============================================================
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade not null,
  subject_id uuid references public.subjects(id),

  started_at timestamptz not null,
  ended_at timestamptz not null,

  duration_seconds int generated always as (
    extract(epoch from (ended_at - started_at))
  ) stored,

  notes text,

  created_at timestamptz default now()
);

alter table study_sessions enable row level security;

create policy "Read all sessions"
  on study_sessions for select using (true);

create policy "User inserts own sessions"
  on study_sessions for insert with check (auth.uid() = user_id);

-- ============================================================
-- 4. DAILY SUMMARIES
-- ============================================================
create table public.daily_summaries (
  user_id uuid references public.profiles(id) on delete cascade,
  date date not null,
  total_seconds int default 0,
  streak_count int default 0,
  updated_at timestamptz default now(),
  primary key (user_id, date)
);

alter table daily_summaries enable row level security;

create policy "Public read (leaderboards)"
  on daily_summaries for select using (true);

-- ============================================================
-- 5. SUBSCRIPTIONS (Stripe-ready)
-- ============================================================
create table public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null,
  plan_id text,
  price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  status_changed_at timestamptz default now()
);

alter table subscriptions enable row level security;

create policy "User can read their own subscription"
  on subscriptions for select using (auth.uid() = user_id);

-- ============================================================
-- 6. AUTOMATIONS (Triggers)
-- ============================================================

-- A. On signup → create profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User_' || substr(new.id::text, 1, 6)),
    'https://api.dicebear.com/7.x/notionists/svg?seed=' || new.id
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- B. On profile update → auto-update updated_at
create or replace function public.update_profile_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_timestamp
  before update on public.profiles
  for each row execute procedure public.update_profile_timestamp();

-- C. On session completion → XP + streak + summary
create or replace function public.handle_session_completed()
returns trigger as $$
declare
  last_day date;
begin
  -- XP
  update public.profiles
  set 
    xp_total = xp_total + new.duration_seconds,
    level = 1 + floor((xp_total + new.duration_seconds) / 3600)
  where id = new.user_id;

  -- Daily summary
  insert into public.daily_summaries (user_id, date, total_seconds)
  values (new.user_id, date(new.started_at), new.duration_seconds)
  on conflict (user_id, date)
  do update set 
    total_seconds = daily_summaries.total_seconds + excluded.total_seconds,
    updated_at = now();

  -- Streak
  select date into last_day
  from public.daily_summaries
  where user_id = new.user_id
  order by date desc
  limit 1 offset 1;

  if last_day = date(new.started_at) - 1 then
    update public.profiles
    set current_streak = current_streak + 1,
        longest_streak = greatest(longest_streak, current_streak + 1)
    where id = new.user_id;
  else
    update public.profiles
    set current_streak = 1,
        longest_streak = greatest(longest_streak, 1)
    where id = new.user_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_session_completed
  after insert on public.study_sessions
  for each row execute procedure public.handle_session_completed();

-- ============================================================
-- 7. WEEKLY LEADERBOARD VIEW
-- ============================================================
create view public.weekly_leaderboard as
  select 
    p.id as user_id,
    p.username,
    p.avatar_url,
    p.level,
    coalesce(sum(s.duration_seconds), 0) as weekly_seconds
  from profiles p
  left join study_sessions s 
    on p.id = s.user_id
    and s.ended_at::date >= (current_date - 7)
  group by p.id, p.username, p.avatar_url, p.level
  order by weekly_seconds desc;

-- ============================================================
-- 8. INDEXES
-- ============================================================
create index on subjects(owner_id);
create index on subjects(parent_subject_id);
create index on study_sessions(user_id);
create index on study_sessions(subject_id);
create index on study_sessions(ended_at);
create index on daily_summaries(user_id, date);
create index on profiles(level);
