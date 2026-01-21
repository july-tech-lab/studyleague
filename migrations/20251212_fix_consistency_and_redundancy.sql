/* -----------------------------------------------------------------------------
  FIX CONSISTENCY AND REDUNDANCY ISSUES
  Date: 2025-12-12
  
  Fixes:
  1. Standardize foreign key references to use profiles(id) instead of auth.users(id)
  2. Add NOT NULL constraint to groups.created_by
  3. Remove unused session_count column from daily_summaries
  4. Standardize function naming (update_profile_timestamp -> set_updated_at)
  
  This ensures consistency across the database schema.
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. FIX FOREIGN KEY CONSISTENCY
  -----------------------------------------------------------------------------
  -- Standardize all user references to use profiles(id) instead of auth.users(id)
  -- This provides a consistent abstraction layer and makes queries easier.
  
  -- Fix tasks.user_id
  ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_user_id_fkey,
    ADD CONSTRAINT tasks_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- Fix group_members.user_id
  ALTER TABLE public.group_members
    DROP CONSTRAINT IF EXISTS group_members_user_id_fkey,
    ADD CONSTRAINT group_members_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -- Fix groups.created_by
  ALTER TABLE public.groups
    DROP CONSTRAINT IF EXISTS groups_created_by_fkey,
    ADD CONSTRAINT groups_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

  -----------------------------------------------------------------------------
  -- 2. ADD NOT NULL CONSTRAINT TO groups.created_by
  -----------------------------------------------------------------------------
  -- A group must always have a creator. This constraint ensures data integrity.
  
  -- First, check if there are any NULL values (shouldn't exist, but just in case)
  -- If NULL values exist, we'll need to handle them before adding NOT NULL
  DO $$
  DECLARE
    null_count integer;
  BEGIN
    SELECT COUNT(*) INTO null_count
    FROM public.groups
    WHERE created_by IS NULL;
    
    IF null_count > 0 THEN
      RAISE EXCEPTION 'Cannot add NOT NULL constraint: % groups have NULL created_by. Please fix these manually first.', null_count;
    END IF;
  END $$;
  
  -- Now add the constraint
  ALTER TABLE public.groups
    ALTER COLUMN created_by SET NOT NULL;

  -----------------------------------------------------------------------------
  -- 3. REMOVE UNUSED session_count COLUMN
  -----------------------------------------------------------------------------
  -- The session_count column in daily_summaries is never updated by triggers
  -- and appears to be unused. The count can be derived from study_sessions if needed.
  
  ALTER TABLE public.daily_summaries
    DROP COLUMN IF EXISTS session_count;

  -----------------------------------------------------------------------------
  -- 4. STANDARDIZE FUNCTION NAMING
  -----------------------------------------------------------------------------
  -- Remove redundant update_profile_timestamp() function and use the shared
  -- set_updated_at() function instead. Both functions are identical, so we
  -- consolidate to use the shared helper for consistency.
  
  -- 4a. Drop old trigger on profiles
  DROP TRIGGER IF EXISTS update_profiles_timestamp ON public.profiles;
  
  -- 4b. Drop the redundant function
  DROP FUNCTION IF EXISTS public.update_profile_timestamp();
  
  -- 4c. Recreate trigger using the shared helper
  CREATE TRIGGER update_profiles_timestamp
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify:
-- 
-- 1. Foreign keys now reference profiles:
--    SELECT 
--      tc.table_name, 
--      kcu.column_name, 
--      ccu.table_name AS foreign_table_name,
--      ccu.column_name AS foreign_column_name
--    FROM information_schema.table_constraints AS tc
--    JOIN information_schema.key_column_usage AS kcu
--      ON tc.constraint_name = kcu.constraint_name
--    JOIN information_schema.constraint_column_usage AS ccu
--      ON ccu.constraint_name = tc.constraint_name
--    WHERE tc.constraint_type = 'FOREIGN KEY'
--      AND tc.table_schema = 'public'
--      AND tc.table_name IN ('tasks', 'group_members', 'groups')
--      AND kcu.column_name IN ('user_id', 'created_by');
--    -- Should show all referencing public.profiles(id)
--
-- 2. groups.created_by is NOT NULL:
--    SELECT column_name, is_nullable
--    FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name = 'groups'
--      AND column_name = 'created_by';
--    -- Should show is_nullable = 'NO'
--
-- 3. daily_summaries.session_count is removed:
--    SELECT column_name
--    FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name = 'daily_summaries';
--    -- Should not include 'session_count'
--
-- 4. Redundant function is removed:
--    SELECT proname
--    FROM pg_proc
--    WHERE proname IN ('set_updated_at', 'update_profile_timestamp');
--    -- Should show 'set_updated_at' only (update_profile_timestamp should not exist)
--
-- 5. Trigger still works:
--    UPDATE public.profiles SET username = username WHERE id = auth.uid();
--    -- Should update updated_at timestamp

