-- 1) Table
create table public.user_subjects (
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);

-- 2) Indexes (optional but useful)
create index user_subjects_user_idx on public.user_subjects (user_id);
create index user_subjects_subject_idx on public.user_subjects (subject_id);

-- 3) RLS
alter table public.user_subjects enable row level security;

-- Policies: users can manage only their own rows
create policy "user_subjects_select_own"
on public.user_subjects for select
using (auth.uid() = user_id);

create policy "user_subjects_insert_own"
on public.user_subjects for insert
with check (auth.uid() = user_id);

create policy "user_subjects_update_own"
on public.user_subjects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_subjects_delete_own"
on public.user_subjects for delete
using (auth.uid() = user_id);