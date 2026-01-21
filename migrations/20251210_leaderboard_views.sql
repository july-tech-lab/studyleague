-- 1) Indexes: Optimized for range scans (Leaderboards)
drop index if exists daily_summaries_date_idx;

-- "Covering Index" allows Postgres to calculate sums without touching the table heap
create index if not exists daily_summaries_covering_idx
  on public.daily_summaries (date, user_id)
  include (total_seconds);

-- 2) Monthly Leaderboard (30 day sliding window)
create or replace view public.monthly_leaderboard as
select
  p.id as user_id,
  p.username,
  p.avatar_url,
  p.level,
  coalesce(sum(ds.total_seconds), 0) as total_seconds
from public.profiles p
left join public.daily_summaries ds
  on ds.user_id = p.id
 and ds.date >= (current_date - interval '30 days')
group by p.id, p.username, p.avatar_url, p.level
order by total_seconds desc;

-- 3) Yearly Leaderboard (365 day sliding window)
create or replace view public.yearly_leaderboard as
select
  p.id as user_id,
  p.username,
  p.avatar_url,
  p.level,
  coalesce(sum(ds.total_seconds), 0) as total_seconds
from public.profiles p
left join public.daily_summaries ds
  on ds.user_id = p.id
 and ds.date >= (current_date - interval '365 days')
group by p.id, p.username, p.avatar_url, p.level
order by total_seconds desc;