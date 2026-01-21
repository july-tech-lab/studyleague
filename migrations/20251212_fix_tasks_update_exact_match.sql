/* -----------------------------------------------------------------------------
  FIX TASKS UPDATE POLICY - EXACT MATCH TO SUBJECTS
  Date: 2025-12-12
  
  Match the EXACT pattern from subjects UPDATE policy which works correctly.
  Key: Use (( SELECT auth.uid() AS uid) = user_id) and include TO authenticated
  -----------------------------------------------------------------------------
*/

BEGIN;

  -- Drop existing UPDATE policy
  DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
  
  -- Create UPDATE policy matching EXACTLY the subjects pattern
  -- This is the exact same pattern that works for subjects
  -- Note: Subjects policy uses "TO authenticated" and the exact same USING/WITH CHECK pattern
  CREATE POLICY "Users can update own tasks"
    ON public.tasks
    FOR UPDATE
    TO authenticated
    USING ((( SELECT auth.uid() AS uid) = user_id))
    WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

  -- Verify the policy was created
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 
      FROM pg_policy pol
      JOIN pg_class pc ON pol.polrelid = pc.oid
      JOIN pg_namespace pn ON pc.relnamespace = pn.oid
      WHERE pn.nspname = 'public' 
        AND pc.relname = 'tasks'
        AND pol.polname = 'Users can update own tasks'
        AND pol.polcmd = 'w'
    ) THEN
      RAISE NOTICE '✓ UPDATE policy recreated with exact subjects pattern';
    ELSE
      RAISE WARNING '⚠️  UPDATE policy may not have been created';
    END IF;
  END$$;

COMMIT;

