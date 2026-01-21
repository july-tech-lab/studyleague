-- Ensure the column used by the app filters exists (some environments were
-- created before the column definition was fixed in the base migration).
alter table if exists public.subjects
  add column if not exists is_active boolean default true;

-- Allow subject owners to delete their own custom subjects.
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subjects'
      and policyname = 'Subjects: owners can delete'
  ) then
    drop policy "Subjects: owners can delete" on public.subjects;
  end if;
end$$;

create policy "Subjects: owners can delete"
on public.subjects
for delete
using (auth.uid() = owner_id);

