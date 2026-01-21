-- Adds invite code, password, and approval flow for groups

do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type membership_status as enum ('pending', 'approved');
  end if;
end$$;

alter table groups
  add column if not exists requires_admin_approval boolean default false,
  add column if not exists invite_code text,
  add column if not exists join_password text,
  add column if not exists has_password boolean generated always as (join_password is not null and length(join_password) > 0) stored;

-- populate missing invite codes then enforce not null + unique
update groups
set invite_code = coalesce(invite_code, lower(encode(gen_random_bytes(4), 'hex')))
where invite_code is null;

alter table groups alter column invite_code set not null;
alter table groups alter column invite_code set default lower(encode(gen_random_bytes(4), 'hex'));
create unique index if not exists idx_groups_invite_code on groups(invite_code);

alter table group_members
  add column if not exists status membership_status default 'approved';

update group_members set status = 'approved' where status is null;

-- Safer join path: drop permissive policy and route through RPC
drop policy if exists "Users can join public groups" on group_members;

create or replace function find_group_by_invite_code(p_code text)
returns table (
  id uuid,
  name text,
  description text,
  visibility group_visibility,
  created_by uuid,
  created_at timestamptz,
  requires_admin_approval boolean,
  invite_code text,
  has_password boolean
) as $$
begin
  return query
  select id, name, description, visibility, created_by, created_at, requires_admin_approval, invite_code, has_password
  from groups
  where lower(invite_code) = lower(p_code);
end;
$$ language plpgsql security definer set search_path=public;

grant execute on function find_group_by_invite_code(text) to authenticated;

create or replace function regenerate_invite_code(p_group_id uuid)
returns table (invite_code text) as $$
declare
  new_code text;
begin
  new_code := lower(encode(gen_random_bytes(4), 'hex'));

  update groups
  set invite_code = new_code
  where id = p_group_id
    and exists (
      select 1 from group_members gm
      where gm.group_id = p_group_id
        and gm.user_id = auth.uid()
        and gm.role = 'group_admin'
    )
  returning invite_code;

  return query select new_code;
end;
$$ language plpgsql security definer set search_path=public;

grant execute on function regenerate_invite_code(uuid) to authenticated;

create or replace function request_join_group(p_group_id uuid, p_password text default null)
returns group_members as $$
declare
  g record;
  result group_members%rowtype;
begin
  select * into g from groups where id = p_group_id;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;

  if g.visibility <> 'public' then
    raise exception 'GROUP_NOT_PUBLIC';
  end if;

  if g.join_password is not null and (p_password is null or p_password <> g.join_password) then
    raise exception 'INVALID_PASSWORD';
  end if;

  if exists (select 1 from group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'ALREADY_MEMBER';
  end if;

  insert into group_members (group_id, user_id, role, status)
  values (
    p_group_id,
    auth.uid(),
    'group_member',
    case when g.requires_admin_approval then 'pending' else 'approved' end
  )
  returning * into result;

  return result;
end;
$$ language plpgsql security definer set search_path=public;

grant execute on function request_join_group(uuid, text) to authenticated;

-- Retirer l’ancienne policy si elle existe
drop policy if exists "Users can view members of groups they belong to" on group_members;

-- Policy simplifiée pour éviter la récursion : lecture ouverte aux authentifiés
drop policy if exists "Users see only approved group members" on group_members;
drop policy if exists "Admins can see all members including pending" on group_members;

create policy "Members selectable (auth only)"
on group_members for select
to authenticated
using (true);