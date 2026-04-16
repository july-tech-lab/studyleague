/* -----------------------------------------------------------------------------
  Profiles: allow authenticated users to INSERT their own row.

  Why: upsertUserProfile() uses POST .../profiles?on_conflict=id (INSERT ... ON
  CONFLICT DO UPDATE). If handle_new_user did not create a row yet (race, web,
  or trigger failure), the INSERT leg runs without an INSERT RLS policy → 403
  Forbidden, onboarding never finishes, subjects are never created.

  Policy: only id = auth.uid() (same UUID as auth.users).
  ----------------------------------------------------------------------------- */

BEGIN;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

COMMIT;
