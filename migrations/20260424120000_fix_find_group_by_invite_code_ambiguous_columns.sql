-- PL/pgSQL: RETURNS TABLE(...) defines output names as variables; unqualified
-- "id", "name", etc. in RETURN QUERY conflict with groups columns (42702).

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
  select
    g.id,
    g.name,
    g.description,
    g.visibility,
    g.created_by,
    g.created_at,
    g.requires_admin_approval,
    g.invite_code,
    g.has_password
  from groups g
  where lower(g.invite_code) = lower(p_code);
end;
$$ language plpgsql security definer set search_path = public;
