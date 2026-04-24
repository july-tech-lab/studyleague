-- request_join_group: CASE branches were inferred as text, but group_members.status
-- is membership_status enum → 42804 on insert. Cast explicitly.
create or replace function public.request_join_group(p_group_id uuid, p_password text default null)
returns public.group_members
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  g record;
  result public.group_members%rowtype;
begin
  select * into g from public.groups where id = p_group_id;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;

  if g.visibility <> 'public' then
    raise exception 'GROUP_NOT_PUBLIC';
  end if;

  if g.join_password is not null and (p_password is null or p_password <> g.join_password) then
    raise exception 'INVALID_PASSWORD';
  end if;

  if exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;

  insert into public.group_members (group_id, user_id, role, status)
  values (
    p_group_id,
    auth.uid(),
    'group_member'::public.group_role,
    case
      when g.requires_admin_approval then 'pending'::public.membership_status
      else 'approved'::public.membership_status
    end
  )
  returning * into result;

  return result;
end;
$$;
