-- Live "who is studying" for group peers + timer sync table user_study_presence.
-- Also: approved members of the same private group can list each other (group_members SELECT).
-- Also: minimal profile fields readable for co-members (username, avatar) for group UI.

-- ---------------------------------------------------------------------------
-- 1) Co-membership helper (profiles RLS)
-- ---------------------------------------------------------------------------
create or replace function public.rls_users_share_approved_group(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm1
    join public.group_members gm2
      on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid()
      and gm2.user_id = p_other_user_id
      and gm1.status = 'approved'::public.membership_status
      and gm2.status = 'approved'::public.membership_status
  );
$$;

alter function public.rls_users_share_approved_group(uuid) owner to postgres;
revoke all on function public.rls_users_share_approved_group(uuid) from public;
grant execute on function public.rls_users_share_approved_group(uuid) to anon, authenticated, service_role;

drop policy if exists "Users can view own profile or public profiles" on public.profiles;
create policy "Users can view own profile or public profiles"
on public.profiles for select
to authenticated
using (
  (select auth.uid()) = id
  or is_public = true
  or public.rls_users_share_approved_group(id)
);

-- ---------------------------------------------------------------------------
-- 2) group_members: approved peers see approved roster (private groups)
-- ---------------------------------------------------------------------------
drop policy if exists "View members of visible groups" on public.group_members;
create policy "View members of visible groups"
on public.group_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.rls_group_is_public_or_current_user_creator(group_id)
  or (
    status = 'approved'::public.membership_status
    and public.rls_current_user_is_approved_group_member(group_id)
  )
);

-- ---------------------------------------------------------------------------
-- 3) user_study_presence
-- ---------------------------------------------------------------------------
create table if not exists public.user_study_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  is_studying boolean not null default false,
  session_started_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.user_study_presence is
  'Ephemeral row per user: timer running state for group live view; stale if updated_at is old.';

create index if not exists idx_user_study_presence_updated
  on public.user_study_presence (updated_at desc)
  where is_studying = true;

alter table public.user_study_presence enable row level security;

drop policy if exists "presence_select_peers" on public.user_study_presence;
create policy "presence_select_peers"
on public.user_study_presence for select
to authenticated
using (
  user_id = auth.uid()
  or public.rls_users_share_approved_group(user_id)
);

drop policy if exists "presence_upsert_own" on public.user_study_presence;
create policy "presence_upsert_own"
on public.user_study_presence for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "presence_update_own" on public.user_study_presence;
create policy "presence_update_own"
on public.user_study_presence for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "presence_delete_own" on public.user_study_presence;
create policy "presence_delete_own"
on public.user_study_presence for delete
to authenticated
using (user_id = auth.uid());

-- Realtime (run in Supabase SQL editor if publication change is restricted)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.user_study_presence';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
