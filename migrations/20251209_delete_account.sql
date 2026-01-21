-- Deletes current authenticated user and cascades app data.
-- Uses security definer to allow self-serve deletion (Apple requirement).
create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  -- Delete dependent data first to avoid FK issues
  delete from study_sessions where user_id = current_user_id;
  delete from tasks where user_id = current_user_id;
  delete from user_subjects where user_id = current_user_id;
  delete from profiles where id = current_user_id;

  -- Remove auth user
  perform auth.delete_user(current_user_id);
end;
$$;

revoke all on function public.delete_current_user() from public;
grant execute on function public.delete_current_user() to authenticated;

