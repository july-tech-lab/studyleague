/* -----------------------------------------------------------------------------
  FOLLOW-UP DATABASE IMPROVEMENTS
  Date: 2025-12-11
  After: 20251211_CTO_IMPROVED.sql
  
  Additional improvements:
  1. Study sessions UPDATE/DELETE policies (security)
  2. Materialized views for leaderboards (performance)
  3. Additional useful indexes
  4. Table comments for documentation
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. SECURITY: Study Sessions UPDATE/DELETE Policies
  -----------------------------------------------------------------------------
  -- Currently: Users can only INSERT their own sessions
  -- Missing: UPDATE and DELETE policies (users should be able to edit/delete their own)

  CREATE POLICY "Users can update own sessions"
    ON public.study_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can delete own sessions"
    ON public.study_sessions FOR DELETE
    USING (auth.uid() = user_id);

  -- NOTE: Keeping "Read all sessions" policy for leaderboard functionality
  -- If you want to restrict this, you can replace it with:
  -- DROP POLICY IF EXISTS "Read all sessions" ON public.study_sessions;
  -- CREATE POLICY "Users can read own sessions"
  --   ON public.study_sessions FOR SELECT
  --   USING (auth.uid() = user_id);

  -----------------------------------------------------------------------------
  -- 2. PERFORMANCE: Materialized Views for Leaderboards
  -----------------------------------------------------------------------------
  -- Regular views recalculate on every query. Materialized views cache results.
  -- Refresh strategy: Use pg_cron or application logic to refresh periodically

  -- Drop existing regular views (they'll be replaced)
  DROP VIEW IF EXISTS public.weekly_leaderboard CASCADE;
  DROP VIEW IF EXISTS public.monthly_leaderboard CASCADE;
  DROP VIEW IF EXISTS public.yearly_leaderboard CASCADE;

  -- Create materialized views
  CREATE MATERIALIZED VIEW public.weekly_leaderboard AS
  SELECT 
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.level,
    COALESCE(SUM(s.duration_seconds), 0) AS weekly_seconds
  FROM public.profiles p
  LEFT JOIN public.study_sessions s 
    ON p.id = s.user_id 
    AND s.ended_at::date >= (CURRENT_DATE - 7)
  GROUP BY p.id, p.username, p.avatar_url, p.level
  ORDER BY weekly_seconds DESC;

  CREATE MATERIALIZED VIEW public.monthly_leaderboard AS
  SELECT 
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.level,
    COALESCE(SUM(ds.total_seconds), 0) AS total_seconds
  FROM public.profiles p
  LEFT JOIN public.daily_summaries ds 
    ON ds.user_id = p.id 
    AND ds.date >= (CURRENT_DATE - 30)
  GROUP BY p.id, p.username, p.avatar_url, p.level
  ORDER BY total_seconds DESC;

  CREATE MATERIALIZED VIEW public.yearly_leaderboard AS
  SELECT 
    p.id AS user_id,
    p.username,
    p.avatar_url,
    p.level,
    COALESCE(SUM(ds.total_seconds), 0) AS total_seconds
  FROM public.profiles p
  LEFT JOIN public.daily_summaries ds 
    ON ds.user_id = p.id 
    AND ds.date >= (CURRENT_DATE - 365)
  GROUP BY p.id, p.username, p.avatar_url, p.level
  ORDER BY total_seconds DESC;

  -- Create indexes on materialized views for faster queries
  CREATE UNIQUE INDEX ON public.weekly_leaderboard(user_id);
  CREATE UNIQUE INDEX ON public.monthly_leaderboard(user_id);
  CREATE UNIQUE INDEX ON public.yearly_leaderboard(user_id);

  -- Create function to refresh all leaderboards
  CREATE OR REPLACE FUNCTION public.refresh_leaderboards()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.weekly_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.monthly_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.yearly_leaderboard;
  END;
  $$;

  COMMENT ON FUNCTION public.refresh_leaderboards() IS 
    'Refreshes all leaderboard materialized views. Call this periodically (e.g., via pg_cron every hour)';

  -- Initial data population
  REFRESH MATERIALIZED VIEW public.weekly_leaderboard;
  REFRESH MATERIALIZED VIEW public.monthly_leaderboard;
  REFRESH MATERIALIZED VIEW public.yearly_leaderboard;

  -- NOTE: Set up pg_cron to refresh periodically:
  -- SELECT cron.schedule('refresh-leaderboards', '0 * * * *', 'SELECT public.refresh_leaderboards()');
  -- Or refresh in your application after session completion

  -----------------------------------------------------------------------------
  -- 3. ADDITIONAL PERFORMANCE INDEXES
  -----------------------------------------------------------------------------

  -- Index for querying sessions by date range (for analytics)
  CREATE INDEX IF NOT EXISTS idx_study_sessions_date_range
    ON public.study_sessions(ended_at DESC, user_id)
    WHERE ended_at IS NOT NULL;

  -- Index for active tasks (commonly filtered)
  CREATE INDEX IF NOT EXISTS idx_tasks_active
    ON public.tasks(user_id, scheduled_for)
    WHERE status IN ('planned', 'in-progress')
      AND scheduled_for IS NOT NULL;

  -- Index for completed tasks (for history queries)
  CREATE INDEX IF NOT EXISTS idx_tasks_completed
    ON public.tasks(user_id, updated_at DESC)
    WHERE status = 'done';

  -- Index for subjects by owner (for user's custom subjects)
  CREATE INDEX IF NOT EXISTS idx_subjects_owner_active
    ON public.subjects(owner_id, is_active)
    WHERE owner_id IS NOT NULL;

  -----------------------------------------------------------------------------
  -- 4. DOCUMENTATION: Table and Column Comments
  -----------------------------------------------------------------------------

  COMMENT ON TABLE public.profiles IS 
    'User profiles with XP, level, streaks, and goals. Linked to auth.users via id.';

  COMMENT ON COLUMN public.profiles.xp_total IS 
    'Total experience points earned (1 second of study = 1 XP)';

  COMMENT ON COLUMN public.profiles.level IS 
    'User level calculated as: 1 + floor(xp_total / 3600)';

  COMMENT ON COLUMN public.profiles.current_streak IS 
    'Current consecutive days with study activity';

  COMMENT ON TABLE public.study_sessions IS 
    'Individual study sessions with start/end times. Duration is auto-calculated.';

  COMMENT ON COLUMN public.study_sessions.duration_seconds IS 
    'Auto-calculated duration in seconds (generated column)';

  COMMENT ON TABLE public.tasks IS 
    'User tasks with planned time and logged time tracking. Status: planned, in-progress, done.';

  COMMENT ON COLUMN public.tasks.logged_seconds IS 
    'Total seconds logged across all linked study sessions (auto-updated by trigger)';

  COMMENT ON TABLE public.daily_summaries IS 
    'Daily aggregated study time per user. Used for streaks and leaderboards.';

  COMMENT ON TABLE public.groups IS 
    'Study groups with invite codes. Visibility: public (anyone can join) or private (invite only).';

  COMMENT ON COLUMN public.groups.invite_code IS 
    'Unique 8-character hex code for joining the group';

  COMMENT ON TABLE public.group_members IS 
    'Group membership with role (admin/member) and status (pending/approved).';

  COMMENT ON COLUMN public.group_members.status IS 
    'Membership status: pending (awaiting approval) or approved (active member)';

  COMMENT ON TABLE public.subjects IS 
    'Subject catalog. owner_id = NULL means global subject, otherwise user-specific.';

  COMMENT ON COLUMN public.subjects.color IS 
    'Hex color code in format #RRGGBB (e.g., #FF5733)';

  COMMENT ON MATERIALIZED VIEW public.weekly_leaderboard IS 
    'Cached weekly leaderboard (last 7 days). Refresh with REFRESH MATERIALIZED VIEW.';

  COMMENT ON MATERIALIZED VIEW public.monthly_leaderboard IS 
    'Cached monthly leaderboard (last 30 days). Refresh with REFRESH MATERIALIZED VIEW.';

  COMMENT ON MATERIALIZED VIEW public.yearly_leaderboard IS 
    'Cached yearly leaderboard (last 365 days). Refresh with REFRESH MATERIALIZED VIEW.';

  -----------------------------------------------------------------------------
  -- 5. OPTIONAL: Add updated_at to groups and subjects
  -----------------------------------------------------------------------------
  -- Uncomment if you want to track when groups/subjects are modified

  -- Add updated_at to groups
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'groups'
        AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.groups
        ADD COLUMN updated_at timestamp with time zone DEFAULT now();
      
      CREATE TRIGGER update_groups_timestamp
        BEFORE UPDATE ON public.groups
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at();
    END IF;
  END$$;

  -- Add updated_at to subjects
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'subjects'
        AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.subjects
        ADD COLUMN updated_at timestamp with time zone DEFAULT now();
      
      CREATE TRIGGER update_subjects_timestamp
        BEFORE UPDATE ON public.subjects
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at();
    END IF;
  END$$;

  -----------------------------------------------------------------------------
  -- 6. USERNAME UNIQUENESS (CRITICAL - GEMINI SUGGESTION)
  -----------------------------------------------------------------------------
  -- Issue: Multiple users can have the same username, breaking:
  --   - User search
  --   - Profile URLs (/user/batman)
  --   - Mentions (@batman)
  --   - Social features
  
  -- First, check for existing duplicates
  DO $$
  DECLARE
    duplicate_count int;
  BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
      SELECT lower(username), COUNT(*) as cnt
      FROM public.profiles
      WHERE username IS NOT NULL
      GROUP BY lower(username)
      HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
      RAISE WARNING 'Found % duplicate username(s). These need to be resolved before adding unique constraint.', duplicate_count;
      RAISE NOTICE 'Run this query to find duplicates:';
      RAISE NOTICE 'SELECT lower(username), COUNT(*) FROM public.profiles WHERE username IS NOT NULL GROUP BY lower(username) HAVING COUNT(*) > 1;';
    ELSE
      -- Create unique, case-insensitive index
      CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique 
        ON public.profiles (lower(username))
        WHERE username IS NOT NULL;  -- Allow NULL usernames (for users who haven't set one)
      
      RAISE NOTICE '✓ Username uniqueness constraint added';
    END IF;
  END$$;

  -----------------------------------------------------------------------------
  -- 7. USERNAME FORMAT VALIDATION (OPTIONAL BUT RECOMMENDED)
  -----------------------------------------------------------------------------
  -- Ensures usernames are URL-safe and mention-safe
  -- Format: Alphanumeric + underscore only, no spaces or special chars
  
  -- Check for invalid usernames first
  DO $$
  DECLARE
    invalid_count int;
  BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM public.profiles
    WHERE username IS NOT NULL
      AND username !~* '^[a-zA-Z0-9_]+$';
    
    IF invalid_count > 0 THEN
      RAISE WARNING 'Found % username(s) with invalid format (spaces/special chars). These need to be cleaned before adding constraint.', invalid_count;
      RAISE NOTICE 'Run this query to find invalid usernames:';
      RAISE NOTICE 'SELECT id, username FROM public.profiles WHERE username IS NOT NULL AND username !~* ''^[a-zA-Z0-9_]+$'';';
      RAISE NOTICE 'Suggested fix: UPDATE public.profiles SET username = regexp_replace(lower(username), ''[^a-z0-9_]'', ''_'', ''g'') WHERE username !~* ''^[a-zA-Z0-9_]+$'';';
    ELSE
      -- Add format constraint
      ALTER TABLE public.profiles
        DROP CONSTRAINT IF EXISTS username_format;
      
      ALTER TABLE public.profiles
        ADD CONSTRAINT username_format
        CHECK (username IS NULL OR username ~* '^[a-zA-Z0-9_]+$');
      
      RAISE NOTICE '✓ Username format constraint added';
    END IF;
  END$$;

  -----------------------------------------------------------------------------
  -- 8. SOFT DELETES FOR TASKS (OPTIONAL - REQUIRES APP CHANGES)
  -----------------------------------------------------------------------------
  -- Allows users to recover accidentally deleted tasks
  -- WARNING: This changes RLS policies. Only enable after updating your app!
  
  -- Add deleted_at column (safe to do now)
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tasks'
        AND column_name = 'deleted_at'
    ) THEN
      ALTER TABLE public.tasks
        ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;
      
      -- Create index for filtering active tasks
      CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at
        ON public.tasks(user_id, deleted_at)
        WHERE deleted_at IS NULL;
      
      RAISE NOTICE '✓ Soft delete column added to tasks';
      RAISE NOTICE '⚠️  RLS policy changes are COMMENTED OUT - enable after updating your app!';
    END IF;
  END$$;

  -- NOTE: RLS policy changes for soft deletes are COMMENTED OUT
  -- Uncomment ONLY after updating your application to use UPDATE instead of DELETE
  -- 
  -- DO $$
  -- BEGIN
  --   IF EXISTS (
  --     SELECT 1 FROM pg_policies
  --     WHERE schemaname = 'public'
  --       AND tablename = 'tasks'
  --       AND policyname = 'Users can manage own tasks'
  --   ) THEN
  --     DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
  --     
  --     CREATE POLICY "Users can view active tasks"
  --       ON public.tasks FOR SELECT
  --       USING (auth.uid() = user_id AND deleted_at IS NULL);
  --     
  --     CREATE POLICY "Users can update own tasks"
  --       ON public.tasks FOR UPDATE
  --       USING (auth.uid() = user_id)
  --       WITH CHECK (auth.uid() = user_id);
  --     
  --     CREATE POLICY "Users can insert own tasks"
  --       ON public.tasks FOR INSERT
  --       WITH CHECK (auth.uid() = user_id);
  --   END IF;
  -- END$$;

  -- Optional: Create a function to hard-delete old soft-deleted tasks (cleanup)
  CREATE OR REPLACE FUNCTION public.cleanup_deleted_tasks()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  BEGIN
    -- Delete tasks that were soft-deleted more than 30 days ago
    DELETE FROM public.tasks
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - interval '30 days';
  END;
  $$;

  COMMENT ON FUNCTION public.cleanup_deleted_tasks() IS 
    'Hard-deletes tasks that were soft-deleted more than 30 days ago. Run periodically via cron.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION ACTIONS
-- ============================================================================

-- 1. If username duplicates were found, resolve them:
--    Option A: Add numbers to duplicates
--    UPDATE public.profiles p1
--    SET username = username || '_' || substr(p1.id::text, 1, 4)
--    WHERE EXISTS (
--      SELECT 1 FROM public.profiles p2
--      WHERE lower(p2.username) = lower(p1.username)
--        AND p2.id < p1.id
--    );
--
--    Option B: Let users choose new usernames (better UX)

-- 2. If invalid username formats were found, clean them:
--    UPDATE public.profiles
--    SET username = regexp_replace(lower(username), '[^a-z0-9_]', '_', 'g')
--    WHERE username IS NOT NULL
--      AND username !~* '^[a-zA-Z0-9_]+$';

-- 3. Update your application code for soft deletes:
--    - Change DELETE queries to: UPDATE tasks SET deleted_at = now() WHERE id = ?
--    - Filter queries to: WHERE deleted_at IS NULL
--    - Add "Restore" functionality: UPDATE tasks SET deleted_at = NULL WHERE id = ?

-- 4. Test username uniqueness:
--    Try creating two users with same username (different case) - should fail



-- ============================================================================
-- POST-MIGRATION SETUP
-- ============================================================================

-- 1. Set up automatic leaderboard refresh (if using pg_cron)
--    Uncomment and run this if you have pg_cron enabled:
-- SELECT cron.schedule(
--   'refresh-leaderboards-hourly',
--   '0 * * * *',  -- Every hour
--   'SELECT public.refresh_leaderboards()'
-- );

-- 2. Or refresh leaderboards in your application code after session completion:
--    Call: SELECT public.refresh_leaderboards();
--    Or refresh individually: REFRESH MATERIALIZED VIEW CONCURRENTLY weekly_leaderboard;

-- 3. Monitor materialized view sizes:
--    SELECT schemaname, matviewname, pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname))
--    FROM pg_matviews WHERE schemaname = 'public';

