/* -----------------------------------------------------------------------------
  FIX SUPABASE SECURITY LINTER ISSUES - PART 2
  Date: 2025-12-12
  
  Fixes:
  1. Set search_path for 7 functions to prevent search_path injection attacks
  2. Revoke SELECT permissions on materialized views from anon role (keep authenticated)
  3. Note: Leaked password protection must be enabled in Supabase Dashboard
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. FIX FUNCTION SEARCH_PATH (Set to empty or explicit schema)
  -----------------------------------------------------------------------------
  -- Setting search_path prevents search_path injection attacks where malicious
  -- users could create objects in schemas that appear earlier in the search_path
  -- and hijack function calls.
  -- 
  -- For functions that only use public schema objects, we set search_path to 'public'
  -- For SECURITY DEFINER functions, we should be extra careful and set it explicitly
  
  -- set_updated_at: Simple trigger function, only uses now()
  CREATE OR REPLACE FUNCTION public.set_updated_at() 
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
    AS $$
  begin
    new.updated_at = now();
    return new;
  end $$;

  -- update_group_member_count: SECURITY DEFINER, uses public.groups
  CREATE OR REPLACE FUNCTION public.update_group_member_count() 
    RETURNS trigger
    LANGUAGE plpgsql 
    SECURITY DEFINER
    SET search_path = public
    AS $$
  BEGIN
    -- Update count when membership changes
    IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
      UPDATE public.groups
      SET member_count = member_count + 1
      WHERE id = NEW.group_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
      UPDATE public.groups
      SET member_count = GREATEST(0, member_count - 1)
      WHERE id = OLD.group_id;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Status changed from pending to approved
      IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
        UPDATE public.groups
        SET member_count = member_count + 1
        WHERE id = NEW.group_id;
      -- Status changed from approved to pending
      ELSIF OLD.status = 'approved' AND NEW.status != 'approved' THEN
        UPDATE public.groups
        SET member_count = GREATEST(0, member_count - 1)
        WHERE id = NEW.group_id;
      END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
  END;
  $$;

  -- handle_session_completed: SECURITY DEFINER, uses public.profiles, public.daily_summaries
  CREATE OR REPLACE FUNCTION public.handle_session_completed() 
    RETURNS trigger
    LANGUAGE plpgsql 
    SECURITY DEFINER
    SET search_path = public
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

    RETURN new;
  END;
  $$;

  -- update_profile_timestamp: Simple trigger function, only uses now()
  CREATE OR REPLACE FUNCTION public.update_profile_timestamp() 
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = public
    AS $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;

  -- handle_new_user: SECURITY DEFINER, uses public.profiles
  CREATE OR REPLACE FUNCTION public.handle_new_user() 
    RETURNS trigger
    LANGUAGE plpgsql 
    SECURITY DEFINER
    SET search_path = public
    AS $$
  BEGIN
    INSERT INTO public.profiles (id, username, avatar_url)
    VALUES (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', 'User_' || substr(new.id::text, 1, 6)),
      'https://api.dicebear.com/7.x/notionists/svg?seed=' || new.id
    )
    ON CONFLICT (id) DO NOTHING; -- <--- Critical Fix
    RETURN new;
  END;
  $$;

  -- refresh_leaderboards: SECURITY DEFINER, uses materialized views
  CREATE OR REPLACE FUNCTION public.refresh_leaderboards() 
    RETURNS void
    LANGUAGE plpgsql 
    SECURITY DEFINER
    SET search_path = public
    AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.weekly_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.monthly_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.yearly_leaderboard;
  END;
  $$;

  -- cleanup_deleted_tasks: SECURITY DEFINER, uses public.tasks
  CREATE OR REPLACE FUNCTION public.cleanup_deleted_tasks() 
    RETURNS void
    LANGUAGE plpgsql 
    SECURITY DEFINER
    SET search_path = public
    AS $$
  BEGIN
    -- Delete tasks that were soft-deleted more than 30 days ago
    DELETE FROM public.tasks
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - interval '30 days';
  END;
  $$;

  -----------------------------------------------------------------------------
  -- 2. REVOKE SELECT PERMISSIONS ON MATERIALIZED VIEWS FROM ANON
  -----------------------------------------------------------------------------
  -- Materialized views should not be accessible to anonymous users.
  -- Authenticated users can still query these views directly from the app.
  -- This prevents unauthenticated access while allowing authenticated users
  -- to access leaderboard data.
  
  REVOKE SELECT ON public.weekly_leaderboard FROM anon;
  REVOKE SELECT ON public.monthly_leaderboard FROM anon;
  REVOKE SELECT ON public.yearly_leaderboard FROM anon;


COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify:
-- 
-- 1. Functions have search_path set:
--    SELECT proname, prosecdef, proconfig 
--    FROM pg_proc 
--    WHERE proname IN (
--      'set_updated_at', 'update_group_member_count', 'handle_session_completed',
--      'update_profile_timestamp', 'handle_new_user', 'refresh_leaderboards',
--      'cleanup_deleted_tasks'
--    );
--    -- proconfig should contain 'search_path=public' for each function
--
-- 2. Materialized views don't have SELECT permissions for anon (but authenticated should):
--    SELECT grantee, privilege_type 
--    FROM information_schema.role_table_grants 
--    WHERE table_name IN ('weekly_leaderboard', 'monthly_leaderboard', 'yearly_leaderboard')
--      AND grantee = 'anon';
--    -- Should return no rows for anon
--    -- authenticated should still have SELECT permissions
--
-- 3. Leaked Password Protection:
--    This must be enabled manually in Supabase Dashboard:
--    Settings > Authentication > Password > Enable "Leaked Password Protection"
--    See: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

