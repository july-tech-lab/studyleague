create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  subject_id      uuid references public.subjects(id) on delete set null,
  title           text not null,
  planned_minutes integer check (planned_minutes >= 0),
  scheduled_for   date,
  logged_seconds  integer not null default 0 check (logged_seconds >= 0),
  status          text not null default 'planned' check (status in ('planned','in-progress','done')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_tasks_updated
before update on public.tasks
for each row execute procedure public.set_updated_at();

create index idx_tasks_user on public.tasks(user_id);
create index idx_tasks_subject on public.tasks(subject_id);
create index idx_tasks_status on public.tasks(status);

alter table public.study_sessions
  add column task_id uuid references public.tasks(id) on delete set null;
create index idx_study_sessions_task on public.study_sessions(task_id);