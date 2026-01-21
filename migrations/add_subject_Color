-- Fix infinite recursion when creating groups and adding creator as member
-- The issue: 
-- 1. RLS SELECT policy on groups queries group_members to check membership
-- 2. When INSERTing a group and using .select(), it triggers the SELECT policy
-- 3. The SELECT policy queries group_members, which has a recursive SELECT policy
-- 4. This causes infinite recursion before the creator is even added as a member
--
-- Solution: Create a security definer function that creates the group AND adds
-- the creator as a member in one transaction, bypassing all RLS checks.

create or replace function create_group_with_creator(
  p_name text,
  p_description text,
  p_visibility group_visibility,
  p_requires_admin_approval boolean,
  p_join_password text
)
returns table (
  id uuid,
  name text,
  description text,
  visibility group_visibility,
  invite_code text,
  requires_admin_approval boolean,
  has_password boolean,
  created_by uuid,
  created_at timestamptz
) as $$
declare
  v_group_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  -- Insert the group
  insert into groups (
    name,
    description,
    visibility,
    requires_admin_approval,
    join_password,
    created_by
  )
  values (
    p_name,
    nullif(trim(p_description), ''),
    p_visibility,
    p_requires_admin_approval,
    nullif(trim(p_join_password), ''),
    v_user_id
  )
  returning groups.id into v_group_id;

  -- Add creator as admin member (bypasses RLS in security definer function)
  insert into group_members (group_id, user_id, role, status)
  values (v_group_id, v_user_id, 'group_admin', 'approved');

  -- Return the created group
  return query
  select 
    g.id,
    g.name,
    g.description,
    g.visibility,
    g.invite_code,
    g.requires_admin_approval,
    g.has_password,
    g.created_by,
    g.created_at
  from groups g
  where g.id = v_group_id;
end;
$$ language plpgsql security definer set search_path=public;

grant execute on function create_group_with_creator(text, text, group_visibility, boolean, text) to authenticated;

-- Keep the add_group_creator_as_admin function for backward compatibility
-- (in case it's used elsewhere)
create or replace function add_group_creator_as_admin(
  p_group_id uuid,
  p_user_id uuid
)
returns group_members as $$
declare
  result group_members%rowtype;
begin
  -- Security check: ensure the caller is the user they claim to be
  if p_user_id is distinct from auth.uid() then
    raise exception 'UNAUTHORIZED';
  end if;

  -- Verify the user is the creator of the group
  if not exists (
    select 1 from groups g
    where g.id = p_group_id
      and g.created_by = p_user_id
  ) then
    raise exception 'NOT_GROUP_CREATOR';
  end if;

  -- Check if already a member (idempotent)
  if exists (
    select 1 from group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
  ) then
    -- Return existing membership
    select * into result from group_members
    where group_id = p_group_id
      and user_id = p_user_id;
    return result;
  end if;

  -- Insert the creator as admin member
  insert into group_members (group_id, user_id, role, status)
  values (p_group_id, p_user_id, 'group_admin', 'approved')
  returning * into result;

  return result;
end;
$$ language plpgsql security definer set search_path=public;

grant execute on function add_group_creator_as_admin(uuid, uuid) to authenticated;

-- Fix the recursive SELECT policy on groups
-- The current policy queries group_members to check membership, causing infinite recursion
-- when group_members queries groups (via foreign key join)
-- 
-- Solution: Create a security definer function to fetch user groups, bypassing RLS recursion
-- The groups SELECT policy will be simplified to allow public groups and groups user created

-- First, create a function to fetch user groups (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_groups(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  visibility group_visibility,
  invite_code text,
  requires_admin_approval boolean,
  has_password boolean,
  created_by uuid,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.description,
    g.visibility,
    g.invite_code,
    g.requires_admin_approval,
    g.has_password,
    g.created_by,
    g.created_at
  FROM public.groups g
  INNER JOIN public.group_members gm ON gm.group_id = g.id
  WHERE gm.user_id = p_user_id
    AND gm.status = 'approved'
    AND (p_user_id = auth.uid() OR g.visibility = 'public');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;

GRANT EXECUTE ON FUNCTION get_user_groups(uuid) TO authenticated;

-- Simplify groups SELECT policy to avoid recursion
-- Allow: public groups, groups user created, or groups accessed via the function above
DROP POLICY IF EXISTS "Users can read groups they belong to or public" ON public.groups;

CREATE POLICY "Users can read groups they belong to or public"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    -- Users can see public groups
    visibility = 'public'
    OR
    -- Users can see groups they created
    created_by = auth.uid()
  );

-- Fix the recursive SELECT policy on group_members
-- The current policy queries group_members to check membership, causing infinite recursion
-- Solution: Simplify to avoid querying group_members within the policy
-- Allow users to see:
-- 1. Their own memberships (user_id = auth.uid())
-- 2. Members of public groups
-- 3. Members of groups they created (check via groups table, no recursion)

DROP POLICY IF EXISTS "View members of visible groups" ON public.group_members;

CREATE POLICY "View members of visible groups"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (
    -- Users can always see their own memberships
    user_id = auth.uid()
    OR
    -- Users can see members of public groups
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
        AND g.visibility = 'public'
    )
    OR
    -- Users can see members of groups they created (no recursion - only checks groups table)
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
        AND g.created_by = auth.uid()
    )
  );
