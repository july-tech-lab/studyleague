/* -----------------------------------------------------------------------------
  FINAL DATABASE IMPROVEMENTS
  Date: 2025-12-11
  After: 20251211_follow_up_improvements.sql
  
  Critical fixes:
  1. Fix group_members RLS policy (privacy leak - allows all users to see all members)
  2. Fix groups RLS policy (allows pending members to see groups)
  3. Fix tasks RLS policy (doesn't filter soft-deleted tasks)
  4. Populate materialized views (they're created with WITH NO DATA)
  5. Add trigger to refresh leaderboards after session completion
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. SECURITY: Fix Group Members RLS Policy (CRITICAL PRIVACY FIX)
  -----------------------------------------------------------------------------
  -- Current issue: Policy allows ALL authenticated users to see ALL group members
  -- This is a privacy leak - users can see pending memberships, private groups, etc.
  
  DROP POLICY IF EXISTS "Group members select (auth only)" ON public.group_members;
  
  CREATE POLICY "View members of visible groups" ON public.group_members
    FOR SELECT
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
              AND gm.user_id = auth.uid()
              AND gm.status = 'approved'  -- Only approved members can see other members
          )
        )
      )
    );

  -----------------------------------------------------------------------------
  -- 2. SECURITY: Fix Groups RLS Policy (Pending Members Can't See Groups)
  -----------------------------------------------------------------------------
  -- Current issue: Policy allows pending members to see groups they're not approved for
  
  DROP POLICY IF EXISTS "Users can read groups they belong to or public" ON public.groups;
  
  CREATE POLICY "Users can read groups they belong to or public" ON public.groups
    FOR SELECT
    USING (
      visibility = 'public' 
      OR EXISTS (
        SELECT 1 FROM public.group_members gm 
        WHERE gm.group_id = groups.id 
          AND gm.user_id = auth.uid()
          AND gm.status = 'approved'  -- Only approved members can see private groups
      )
    );

  -----------------------------------------------------------------------------
  -- 3. SECURITY: Fix Tasks RLS Policy (Filter Soft-Deleted Tasks)
  -----------------------------------------------------------------------------
  -- Current issue: If soft deletes are implemented, SELECT should exclude deleted tasks
  -- Note: This only applies if you've enabled soft deletes (deleted_at column exists)
  
  DO $$
  BEGIN
    -- Check if deleted_at column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tasks'
        AND column_name = 'deleted_at'
    ) THEN
      -- Drop the ALL policy
      DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
      
      -- Create granular policies that exclude soft-deleted tasks
      CREATE POLICY "Users can view active tasks"
        ON public.tasks FOR SELECT
        USING (
          auth.uid() = user_id 
          AND deleted_at IS NULL
        );
      
      CREATE POLICY "Users can update own tasks"
        ON public.tasks FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can insert own tasks"
        ON public.tasks FOR INSERT
        WITH CHECK (auth.uid() = user_id);
      
      -- Note: No DELETE policy - users should UPDATE deleted_at instead
      
      RAISE NOTICE '✓ Tasks RLS policies updated for soft deletes';
    ELSE
      RAISE NOTICE '⚠️  Soft deletes not enabled for tasks - skipping RLS update';
    END IF;
  END$$;

  -----------------------------------------------------------------------------
  -- 4. PERFORMANCE: Populate Materialized Views
  -----------------------------------------------------------------------------
  -- Current issue: Materialized views are created with WITH NO DATA
  -- They need to be populated before they can be queried

  REFRESH MATERIALIZED VIEW public.weekly_leaderboard;
  REFRESH MATERIALIZED VIEW public.monthly_leaderboard;
  REFRESH MATERIALIZED VIEW public.yearly_leaderboard;

  -----------------------------------------------------------------------------
  -- 5. ADDITIONAL: Add Index for Group Members Status Lookups
  -----------------------------------------------------------------------------
  -- This index already exists, but verifying it's there for the new policy
  
  CREATE INDEX IF NOT EXISTS idx_group_members_group_status_approved
    ON public.group_members(group_id, user_id, status)
    WHERE status = 'approved';

COMMIT;

-- ============================================================================
-- POST-MIGRATION ACTIONS
-- ============================================================================

-- 1. Verify materialized views are populated:
--    SELECT COUNT(*) FROM public.weekly_leaderboard;
--    SELECT COUNT(*) FROM public.monthly_leaderboard;
--    SELECT COUNT(*) FROM public.yearly_leaderboard;

-- 2. Test group members privacy:
--    -- As user A, try to see members of a private group you're not in
--    -- Should return 0 rows

-- 3. Test groups visibility:
--    -- As a pending member, try to see a private group
--    -- Should return 0 rows until approved

-- 4. If using soft deletes for tasks:
--    -- Verify deleted tasks are hidden from SELECT queries
--    -- UPDATE tasks SET deleted_at = now() WHERE id = ?;  -- Should hide it

-- 5. Set up automatic leaderboard refresh:
--    See: migrations/20251211_setup_leaderboard_refresh.sql
--    Recommended: Use pg_cron for periodic refresh (every 5-10 minutes)

-- ============================================================================
-- SUMMARY OF FIXES
-- ============================================================================
-- ✅ Fixed group_members RLS policy (privacy leak)
-- ✅ Fixed groups RLS policy (pending members can't see groups)
-- ✅ Fixed tasks RLS policy (filters soft-deleted tasks if enabled)
-- ✅ Populated materialized views (they were empty)
-- ✅ Added index for group members status lookups
-- ⚠️  Leaderboard auto-refresh: Choose pg_cron, app code, or trigger (see above)

