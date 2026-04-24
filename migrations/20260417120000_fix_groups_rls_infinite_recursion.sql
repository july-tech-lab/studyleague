-- Break RLS recursion between public.groups and public.group_members.
--
-- Problem: "Users can read groups they belong to or public" queried group_members.
-- "View members of visible groups" on group_members queried groups. PostgreSQL can
-- evaluate both sides of OR, causing: 42P17 infinite recursion detected in policy for relation "groups".
--
-- Fix: SECURITY DEFINER helpers (table owner bypasses RLS inside the function body).

create or replace function public.rls_current_user_is_approved_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.status = 'approved'::public.membership_status
  );
$$;

create or replace function public.rls_current_user_is_approved_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.role = 'group_admin'::public.group_role
      and gm.status = 'approved'::public.membership_status
  );
$$;

create or replace function public.rls_group_is_public_or_current_user_creator(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and (
        g.visibility = 'public'::public.group_visibility
        or g.created_by = auth.uid()
      )
  );
$$;

alter function public.rls_current_user_is_approved_group_member(uuid) owner to postgres;
alter function public.rls_current_user_is_approved_group_admin(uuid) owner to postgres;
alter function public.rls_group_is_public_or_current_user_creator(uuid) owner to postgres;

revoke all on function public.rls_current_user_is_approved_group_member(uuid) from public;
revoke all on function public.rls_current_user_is_approved_group_admin(uuid) from public;
revoke all on function public.rls_group_is_public_or_current_user_creator(uuid) from public;

grant execute on function public.rls_current_user_is_approved_group_member(uuid) to anon, authenticated, service_role;
grant execute on function public.rls_current_user_is_approved_group_admin(uuid) to anon, authenticated, service_role;
grant execute on function public.rls_group_is_public_or_current_user_creator(uuid) to anon, authenticated, service_role;

drop policy if exists "Admins can update groups" on public.groups;
create policy "Admins can update groups"
on public.groups for update
to authenticated
using (public.rls_current_user_is_approved_group_admin(id))
with check (public.rls_current_user_is_approved_group_admin(id));

drop policy if exists "Group creators and admins can delete groups" on public.groups;
create policy "Group creators and admins can delete groups"
on public.groups for delete
to authenticated
using (
  (select auth.uid()) = created_by
  or public.rls_current_user_is_approved_group_admin(id)
);

drop policy if exists "Users can read groups they belong to or public" on public.groups;
create policy "Users can read groups they belong to or public"
on public.groups for select
using (
  visibility = 'public'::public.group_visibility
  or created_by = auth.uid()
  or public.rls_current_user_is_approved_group_member(id)
);

drop policy if exists "View members of visible groups" on public.group_members;
create policy "View members of visible groups"
on public.group_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.rls_group_is_public_or_current_user_creator(group_id)
);
