/* -----------------------------------------------------------------------------
  IMPROVED CTO REMEDIATION SCRIPT
  Date: 2025-12-11
  Based on: CTO script with critical improvements
  
  Improvements:
  - Added status check to group_members policy
  - Added data integrity constraints
  - Added performance indexes
  - Fixed hex color validation
  - Added task update in handle_session_completed
  -----------------------------------------------------------------------------
*/

BEGIN; -- Start a transaction to ensure all or nothing applies

  -----------------------------------------------------------------------------
  -- 1. SECURITY FIXES (RLS)
  -----------------------------------------------------------------------------

  -- A. Secure the 'tasks' table (It had RLS enabled but NO policies)
  -- Allow users to do everything (ALL) to their own tasks only.
  DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can read own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

  CREATE POLICY "Users can manage own tasks" ON public.tasks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- B. Fix 'group_members' privacy leak
  -- IMPROVED: Now checks for approved status
  DROP POLICY IF EXISTS "Members selectable (auth only)" ON public.group_members;
  DROP POLICY IF EXISTS "View members of visible groups" ON public.group_members;

  CREATE POLICY "View members of visible groups" ON public.group_members
    FOR SELECT
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
              AND gm.status = 'approved'  -- ← CRITICAL: Only approved members
          )
        )
      )
    );

  -----------------------------------------------------------------------------
  -- 2. PERFORMANCE FIXES (INDEXES)
  -----------------------------------------------------------------------------

  -- Add indexes to Foreign Keys that are missing them
  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_subject_id ON public.tasks(subject_id);
  CREATE INDEX IF NOT EXISTS idx_study_sessions_subject_id ON public.study_sessions(subject_id);

  -- Optimizing the 'daily_summaries' lookup which happens on every session insert
  CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date ON public.daily_summaries(user_id, date);

  -- ADDITIONAL: Composite indexes for common query patterns
  CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date
    ON public.study_sessions(user_id, started_at DESC);

  CREATE INDEX IF NOT EXISTS idx_study_sessions_started_at
    ON public.study_sessions(started_at DESC);

  CREATE INDEX IF NOT EXISTS idx_tasks_user_status_date
    ON public.tasks(user_id, status, scheduled_for)
    WHERE scheduled_for IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_tasks_status_filter
    ON public.tasks(user_id, status);

  CREATE INDEX IF NOT EXISTS idx_group_members_status
    ON public.group_members(group_id, status)
    WHERE status = 'pending';

  CREATE INDEX IF NOT EXISTS idx_groups_created_by
    ON public.groups(created_by);

  -----------------------------------------------------------------------------
  -- 3. DATA INTEGRITY (CONSTRAINTS)
  -----------------------------------------------------------------------------

  -- A. Hex color validation (from CTO script)
  ALTER TABLE public.subjects 
    DROP CONSTRAINT IF EXISTS check_hex_color;
  ALTER TABLE public.subjects
    ADD CONSTRAINT check_hex_color 
    CHECK (color IS NULL OR color ~* '^#[a-f0-9]{6}$')  -- ← IMPROVED: Allow NULL
    NOT VALID;

  -- B. Session duration validation
  ALTER TABLE public.study_sessions
    DROP CONSTRAINT IF EXISTS check_session_duration;
  ALTER TABLE public.study_sessions
    ADD CONSTRAINT check_session_duration
    CHECK (ended_at > started_at);

  -- C. Reasonable session duration (max 24 hours)
  ALTER TABLE public.study_sessions
    DROP CONSTRAINT IF EXISTS check_duration_reasonable;
  ALTER TABLE public.study_sessions
    ADD CONSTRAINT check_duration_reasonable
    CHECK (duration_seconds > 0 AND duration_seconds <= 86400);

  -- D. Task validation
  ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS check_logged_vs_planned;
  ALTER TABLE public.tasks
    ADD CONSTRAINT check_logged_vs_planned
    CHECK (planned_minutes IS NULL OR logged_seconds <= (planned_minutes * 60));

  -- E. Weekly goal validation
  ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS check_weekly_goal;
  ALTER TABLE public.profiles
    ADD CONSTRAINT check_weekly_goal
    CHECK (weekly_goal_minutes >= 0 AND weekly_goal_minutes <= 10080);

  -- F. Invite code format
  ALTER TABLE public.groups
    DROP CONSTRAINT IF EXISTS check_invite_code_format;
  ALTER TABLE public.groups
    ADD CONSTRAINT check_invite_code_format
    CHECK (char_length(invite_code) >= 4);

  -- NOTE: Validate hex color constraint after cleaning up any invalid data:
  -- UPDATE public.subjects SET color = '#000000' WHERE color IS NOT NULL AND color !~* '^#[a-f0-9]{6}$';
  -- ALTER TABLE public.subjects VALIDATE CONSTRAINT check_hex_color;

  -----------------------------------------------------------------------------
  -- 4. REFACTORING DANGEROUS FUNCTIONS
  -----------------------------------------------------------------------------

  -- A. Simplified delete_current_user (from CTO script)
  CREATE OR REPLACE FUNCTION public.delete_current_user()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
  AS $$
  BEGIN
    -- Simply delete the user from auth.users. 
    -- Because you have ON DELETE CASCADE set up on profiles, tasks, etc.,
    -- Postgres will automatically and safely clean up all related data.
    DELETE FROM auth.users WHERE id = auth.uid();
  END;
  $$;

  -- B. IMPROVED & FIXED: Handle session completion (Streak Fix + Task Update)
  -- FIX: Prevents infinite streak glitch by only calculating streak once per day
  CREATE OR REPLACE FUNCTION public.handle_session_completed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    last_day date;
    session_date date;
    has_studied_today boolean;
  BEGIN
    session_date := date(new.started_at);

    -- 1. XP and Level Update (Always happens)
    UPDATE public.profiles
    SET 
      xp_total = xp_total + new.duration_seconds,
      level = 1 + floor((xp_total + new.duration_seconds) / 3600)
    WHERE id = new.user_id;

    -- 2. Check if we have ALREADY counted a streak for today
    -- We do this check BEFORE inserting the new summary row
    SELECT EXISTS (
      SELECT 1 FROM public.daily_summaries 
      WHERE user_id = new.user_id AND date = session_date
    ) INTO has_studied_today;

    -- 3. Daily Summary Upsert
    INSERT INTO public.daily_summaries (user_id, date, total_seconds)
    VALUES (new.user_id, session_date, new.duration_seconds)
    ON CONFLICT (user_id, date)
    DO UPDATE SET 
      total_seconds = daily_summaries.total_seconds + excluded.total_seconds,
      updated_at = now();

    -- 4. Streak Calculation (Run ONLY if this is the first session of the day)
    IF NOT has_studied_today THEN
      
      -- Get the most recent day before today
      SELECT date INTO last_day
      FROM public.daily_summaries
      WHERE user_id = new.user_id
        AND date < session_date
      ORDER BY date DESC
      LIMIT 1;

      -- Update streak
      IF last_day = session_date - 1 THEN
        -- Consecutive day: Increment
        UPDATE public.profiles
        SET 
          current_streak = current_streak + 1,
          longest_streak = GREATEST(longest_streak, current_streak + 1)
        WHERE id = new.user_id;
      ELSE
        -- Streak broken (or first ever session): Reset to 1
        UPDATE public.profiles
        SET 
          current_streak = 1,
          longest_streak = GREATEST(longest_streak, 1) -- Keep longest record
        WHERE id = new.user_id;
      END IF;
      
    END IF;

    -- 5. Update task logged_seconds (if linked)
    IF new.task_id IS NOT NULL THEN
      UPDATE public.tasks
      SET 
        logged_seconds = logged_seconds + new.duration_seconds,
        updated_at = now()
      WHERE id = new.task_id;
    END IF;

    RETURN new;
  END;
  $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 1. Validate hex color constraint after cleaning invalid data:
--    ALTER TABLE public.subjects VALIDATE CONSTRAINT check_hex_color;
--
-- 2. Monitor query performance with new indexes
--
-- 3. Test RLS policies thoroughly, especially group_members visibility


/* -----------------------------------------------------------------------------
  CLEANUP REDUNDANCIES
  -----------------------------------------------------------------------------
*/
  -----------------------------------------------------------------------------
  -- 1. REMOVE DUPLICATE INDEXES
  -----------------------------------------------------------------------------
  
  DROP INDEX IF EXISTS public.idx_daily_summaries_user_date;
  DROP INDEX IF EXISTS public.idx_tasks_user_id;
  DROP INDEX IF EXISTS public.idx_tasks_subject_id;
  DROP INDEX IF EXISTS public.idx_study_sessions_subject_id;
  DROP INDEX IF EXISTS public.study_sessions_user_id_idx;

  -----------------------------------------------------------------------------
  -- 2. REMOVE REDUNDANT RLS POLICIES
  -----------------------------------------------------------------------------

  DROP POLICY IF EXISTS "Users can read groups they belong to" ON public.groups;