-- Reset group_members RLS policies to avoid recursive lookups
-- and keep a minimal, non-recursive rule set.

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_members'
  loop
    -- %I already quotes identifiers; do not wrap it in extra quotes.
    execute format('drop policy if exists %I on group_members', pol.policyname);
  end loop;
end$$;

-- Ensure RLS stays enabled (idempotent).
alter table group_members enable row level security;

-- Read: any authenticated user can read rows. Client filters as needed.
create policy "Group members select (auth only)"
on group_members for select
to authenticated
using (true);

-- Insert: only allow inserting yourself. Business rules enforced in RPCs.
create policy "Group members insert self"
on group_members for insert
to authenticated
with check (auth.uid() = user_id);

-- Delete: allow users to remove their own membership.
create policy "Group members delete self"
on group_members for delete
to authenticated
using (auth.uid() = user_id);



