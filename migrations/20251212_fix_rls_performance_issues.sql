/* -----------------------------------------------------------------------------
  FIX RLS PERFORMANCE ISSUES (Auth RLS Initialization Plan)
  Date: 2025-12-12
  
  Fixes all RLS policies that re-evaluate auth.uid() for each row.
  Solution: Wrap auth.uid() calls in (select auth.uid()) to evaluate once per query.
  
  Based on Supabase Performance Advisor warnings:
  https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. PROFILES: Update own profile
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
  
  CREATE POLICY "Update own profile"
    ON public.profiles FOR UPDATE
    USING ((select auth.uid()) = id);

  -----------------------------------------------------------------------------
  -- 2. SUBJECTS: User creates personal subjects
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "User creates personal subjects" ON public.subjects;
  
  CREATE POLICY "User creates personal subjects"
    ON public.subjects FOR INSERT
    WITH CHECK ((select auth.uid()) = owner_id);

  -----------------------------------------------------------------------------
  -- 3. SUBJECTS: Subjects: owners can delete
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Subjects: owners can delete" ON public.subjects;
  
  CREATE POLICY "Subjects: owners can delete"
    ON public.subjects FOR DELETE
    USING ((select auth.uid()) = owner_id);

  -----------------------------------------------------------------------------
  -- 4. STUDY_SESSIONS: User inserts own sessions
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "User inserts own sessions" ON public.study_sessions;
  
  CREATE POLICY "User inserts own sessions"
    ON public.study_sessions FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 5. STUDY_SESSIONS: Users can read own sessions
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Users can read own sessions" ON public.study_sessions;
  
  CREATE POLICY "Users can read own sessions"
    ON public.study_sessions FOR SELECT
    USING ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 6. STUDY_SESSIONS: Users can update own sessions
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Users can update own sessions" ON public.study_sessions;
  
  CREATE POLICY "Users can update own sessions"
    ON public.study_sessions FOR UPDATE
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 7. STUDY_SESSIONS: Users can delete own sessions
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Users can delete own sessions" ON public.study_sessions;
  
  CREATE POLICY "Users can delete own sessions"
    ON public.study_sessions FOR DELETE
    USING ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 8. SUBSCRIPTIONS: User can read their own subscription
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "User can read their own subscription" ON public.subscriptions;
  
  CREATE POLICY "User can read their own subscription"
    ON public.subscriptions FOR SELECT
    USING ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 9. USER_SUBJECTS: All policies (select, insert, update, delete)
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "user_subjects_select_own" ON public.user_subjects;
  DROP POLICY IF EXISTS "user_subjects_insert_own" ON public.user_subjects;
  DROP POLICY IF EXISTS "user_subjects_update_own" ON public.user_subjects;
  DROP POLICY IF EXISTS "user_subjects_delete_own" ON public.user_subjects;
  
  CREATE POLICY "user_subjects_select_own"
    ON public.user_subjects FOR SELECT
    USING ((select auth.uid()) = user_id);
  
  CREATE POLICY "user_subjects_insert_own"
    ON public.user_subjects FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);
  
  CREATE POLICY "user_subjects_update_own"
    ON public.user_subjects FOR UPDATE
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);
  
  CREATE POLICY "user_subjects_delete_own"
    ON public.user_subjects FOR DELETE
    USING ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 10. GROUPS: Users can create groups
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
  
  CREATE POLICY "Users can create groups"
    ON public.groups FOR INSERT
    WITH CHECK ((select auth.uid()) = created_by);

  -----------------------------------------------------------------------------
  -- 11. GROUPS: Admins can update groups
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Admins can update groups" ON public.groups;
  
  CREATE POLICY "Admins can update groups"
    ON public.groups FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = groups.id
          AND gm.user_id = (select auth.uid())
          AND gm.role = 'group_admin'
      )
    )
    WITH CHECK (true);

  -----------------------------------------------------------------------------
  -- 12. GROUPS: Users can read groups they belong to or public
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Users can read groups they belong to or public" ON public.groups;
  
  CREATE POLICY "Users can read groups they belong to or public"
    ON public.groups FOR SELECT
    USING (
      visibility = 'public' 
      OR EXISTS (
        SELECT 1 FROM public.group_members gm 
        WHERE gm.group_id = groups.id 
          AND gm.user_id = (select auth.uid())
          AND gm.status = 'approved'
      )
    );

  -----------------------------------------------------------------------------
  -- 13. GROUP_MEMBERS: Group members insert self
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Group members insert self" ON public.group_members;
  
  CREATE POLICY "Group members insert self"
    ON public.group_members FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 14. GROUP_MEMBERS: Group members delete self
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Group members delete self" ON public.group_members;
  
  CREATE POLICY "Group members delete self"
    ON public.group_members FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 15. GROUP_MEMBERS: View members of visible groups
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "View members of visible groups" ON public.group_members;
  
  CREATE POLICY "View members of visible groups"
    ON public.group_members FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_members.group_id
        AND (
          g.visibility = 'public' 
          OR EXISTS (
            SELECT 1 FROM public.group_members gm 
            WHERE gm.group_id = g.id 
              AND gm.user_id = (select auth.uid())
              AND gm.status = 'approved'
          )
        )
      )
    );

  -----------------------------------------------------------------------------
  -- 16. TASKS: Users can view active tasks
  -----------------------------------------------------------------------------
  -- Handle both cases: with and without deleted_at column (soft deletes)
  DO $$
  BEGIN
    DROP POLICY IF EXISTS "Users can view active tasks" ON public.tasks;
    
    -- Check if deleted_at column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tasks'
        AND column_name = 'deleted_at'
    ) THEN
      -- With soft deletes: filter out deleted tasks
      CREATE POLICY "Users can view active tasks"
        ON public.tasks FOR SELECT
        USING (
          (select auth.uid()) = user_id 
          AND deleted_at IS NULL
        );
    ELSE
      -- Without soft deletes: just check ownership
      CREATE POLICY "Users can view active tasks"
        ON public.tasks FOR SELECT
        USING ((select auth.uid()) = user_id);
    END IF;
  END$$;

  -----------------------------------------------------------------------------
  -- 17. TASKS: Users can update own tasks
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
  
  CREATE POLICY "Users can update own tasks"
    ON public.tasks FOR UPDATE
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 18. TASKS: Users can insert own tasks
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
  
  CREATE POLICY "Users can insert own tasks"
    ON public.tasks FOR INSERT
    WITH CHECK ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 19. DAILY_SUMMARIES: Users can read own daily summaries
  -----------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Users can read own daily summaries" ON public.daily_summaries;
  
  CREATE POLICY "Users can read own daily summaries"
    ON public.daily_summaries FOR SELECT
    USING ((select auth.uid()) = user_id);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify:
-- 1. All policies use (select auth.uid()) instead of auth.uid()
-- 2. Performance advisor warnings should be resolved
-- 3. Test that RLS policies still work correctly:
--    - Users can only see/modify their own data
--    - Group visibility rules are enforced
--    - Task access is restricted to owners

