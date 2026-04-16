/* Same as migrations/20260415_profiles_rls_insert_own.sql — keep in sync. */
BEGIN;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

COMMIT;
