/* -----------------------------------------------------------------------------
  CREATE TASKS RLS POLICIES FOR SOFT DELETES
  Date: 2025-12-12
  
  Creates all necessary RLS policies for tasks table with soft delete support.
  -----------------------------------------------------------------------------
*/

BEGIN;

  -- Ensure RLS is enabled
  ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies to start fresh
  DROP POLICY IF EXISTS "Users can view active tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;

  -- 1. SELECT policy: Users can view their own active (non-deleted) tasks
  CREATE POLICY "Users can view active tasks"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (
      auth.uid() = user_id
      AND deleted_at IS NULL
    );

  -- 2. UPDATE policy: Users can update their own tasks (including setting deleted_at)
  -- CRITICAL: This must NOT filter by deleted_at in USING clause
  CREATE POLICY "Users can update own tasks"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (
      -- Check ownership only - don't filter by deleted_at
      auth.uid() = user_id
    )
    WITH CHECK (
      -- Only check ownership - allow deleted_at to be set to any value
      auth.uid() = user_id
    );

  -- 3. INSERT policy: Users can insert their own tasks
  CREATE POLICY "Users can insert own tasks"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (
      auth.uid() = user_id
    );

  -- Verify policies were created
  DO $$
  DECLARE
    policy_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tasks';
    
    RAISE NOTICE '✓ Created % RLS policies for tasks table', policy_count;
    
    IF policy_count = 0 THEN
      RAISE EXCEPTION 'No policies were created!';
    END IF;
  END$$;

COMMIT;

