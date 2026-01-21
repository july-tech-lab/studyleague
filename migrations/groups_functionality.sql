-- ============================================================
-- 0. Enum : group_role
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'group_role') then
    create type group_role as enum ('group_admin', 'group_member');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'group_visibility') then
    create type group_visibility as enum ('public', 'private');
  end if;
end$$;

-- ============================================================
-- 1. Table : groups
-- ============================================================

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  visibility group_visibility default 'private',
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now()
);

-- ============================================================
-- 2. Table : group_members
-- ============================================================

create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role group_role default 'group_member',
  created_at timestamp with time zone default now()
);

-- Avoid duplicate memberships
alter table group_members
  add constraint group_members_unique unique (group_id, user_id);

create index if not exists idx_group_members_group on group_members(group_id);
create index if not exists idx_group_members_user on group_members(user_id);


-- ============================================================
-- 3. RLS (Security Policies)
-- ============================================================

alter table groups enable row level security;
alter table group_members enable row level security;

-- Read groups I belong to or public ones
create policy "Users can read groups they belong to or public"
on groups for select
using (
  groups.visibility = 'public'
  or exists (
    select 1 from group_members gm
    where gm.group_id = groups.id
      and gm.user_id = auth.uid()
  )
);

-- Create a group
create policy "Users can create groups"
on groups for insert
with check (auth.uid() = created_by);

-- Admins can update group metadata
create policy "Admins can update groups"
on groups for update
using (
  exists (
    select 1 from group_members gm
    where gm.group_id = groups.id
      and gm.user_id = auth.uid()
      and gm.role = 'group_admin'
  )
)
with check (true);

-- View members of groups I belong to
create policy "Users can view members of groups they belong to"
on group_members for select
using (
  exists (
    select 1
    from group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
  )
);

-- Add a member (only admin of the group)
create policy "Admins can add members"
on group_members for insert
with check (
  exists (
    select 1 from group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'group_admin'
  )
);

-- Creator can add themselves as first member/admin
create policy "Creator can add self to their group"
on group_members for insert
with check (
  group_members.user_id = auth.uid()
  and exists (
    select 1 from groups g
    where g.id = group_members.group_id
      and g.created_by = auth.uid()
  )
);

-- Users can join a public group
create policy "Users can join public groups"
on group_members for insert
with check (
  group_members.user_id = auth.uid()
  and exists (
    select 1 from groups g
    where g.id = group_members.group_id
      and g.visibility = 'public'
  )
);

-- A member can leave the group
create policy "Users can delete themselves"
on group_members for delete
using (user_id = auth.uid());

-- Admin can remove a member
create policy "Admins can remove members"
on group_members for delete
using (
  exists (
    select 1 from group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and gm.role = 'group_admin'
  )
);