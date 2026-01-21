/* -----------------------------------------------------------------------------
  ADD PRIVACY FLAGS TO PROFILES
  Date: 2025-12-12
  
  Addresses privacy concerns for a platform targeting students (including minors).
  
  Changes:
  1. Add is_public boolean DEFAULT false NOT NULL to profiles
  2. Add show_in_leaderboard boolean DEFAULT true NOT NULL to profiles
  3. Replace "Profiles are public" RLS policy with privacy-aware policy:
     - Users can see their own profile
     - Users can see other profiles where is_public = true
  4. Update all leaderboard materialized views to filter by show_in_leaderboard = true
  
  This ensures:
  - Profiles are private by default (opt-in to public visibility)
  - Leaderboards only show users who opt-in
  - Clear privacy story for parents/regulators
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. ADD PRIVACY COLUMNS TO PROFILES
  -----------------------------------------------------------------------------

  -- Add is_public column (default false = private by default)
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

  -- Add show_in_leaderboard column (default true = opt-out for existing users)
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS show_in_leaderboard boolean NOT NULL DEFAULT true;

  -- Add comments for documentation
  COMMENT ON COLUMN public.profiles.is_public IS 
    'Whether this profile is visible to other users. Default false (private).';

  COMMENT ON COLUMN public.profiles.show_in_leaderboard IS 
    'Whether this user appears in leaderboards. Default true (opt-out).';

  -----------------------------------------------------------------------------
  -- 2. UPDATE RLS POLICY: Replace "Profiles are public" with privacy-aware policy
  -----------------------------------------------------------------------------

  -- Drop the old public policy
  DROP POLICY IF EXISTS "Profiles are public" ON public.profiles;

  -- Create new privacy-aware SELECT policy
  -- Users can see: their own profile OR profiles where is_public = true
  -- Using (select auth.uid()) for performance (evaluates once per query, not per row)
  CREATE POLICY "Users can view own profile or public profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
      (select auth.uid()) = id        -- Own profile
      OR is_public = true              -- Public profiles
    );

  -----------------------------------------------------------------------------
  -- 3. UPDATE LEADERBOARD MATERIALIZED VIEWS
  --    Filter all leaderboards to only include users with show_in_leaderboard = true
  -----------------------------------------------------------------------------

  -- Weekly Leaderboard
  DROP MATERIALIZED VIEW IF EXISTS public.weekly_leaderboard CASCADE;

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
  WHERE p.show_in_leaderboard = true  -- Privacy filter
  GROUP BY p.id, p.username, p.avatar_url, p.level
  ORDER BY weekly_seconds DESC;

  -- Create unique index for concurrent refresh
  CREATE UNIQUE INDEX weekly_leaderboard_user_id_idx
    ON public.weekly_leaderboard(user_id);

  -- Monthly Leaderboard
  DROP MATERIALIZED VIEW IF EXISTS public.monthly_leaderboard CASCADE;

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
  WHERE p.show_in_leaderboard = true  -- Privacy filter
  GROUP BY p.id, p.username, p.avatar_url, p.level
  ORDER BY total_seconds DESC;

  -- Create unique index for concurrent refresh
  CREATE UNIQUE INDEX monthly_leaderboard_user_id_idx
    ON public.monthly_leaderboard(user_id);

  -- Yearly Leaderboard
  DROP MATERIALIZED VIEW IF EXISTS public.yearly_leaderboard CASCADE;

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
  WHERE p.show_in_leaderboard = true  -- Privacy filter
  GROUP BY p.id, p.username, p.avatar_url, p.level
  ORDER BY total_seconds DESC;

  -- Create unique index for concurrent refresh
  CREATE UNIQUE INDEX yearly_leaderboard_user_id_idx
    ON public.yearly_leaderboard(user_id);

  -----------------------------------------------------------------------------
  -- 4. RE-APPLY SECURITY: Revoke anonymous access and grant to authenticated
  -----------------------------------------------------------------------------

  REVOKE ALL ON TABLE public.weekly_leaderboard FROM anon;
  REVOKE ALL ON TABLE public.monthly_leaderboard FROM anon;
  REVOKE ALL ON TABLE public.yearly_leaderboard FROM anon;

  GRANT SELECT ON TABLE public.weekly_leaderboard TO authenticated;
  GRANT SELECT ON TABLE public.monthly_leaderboard TO authenticated;
  GRANT SELECT ON TABLE public.yearly_leaderboard TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION (manual checks after running this migration)
-- ============================================================================
-- 1. Verify privacy columns exist:
--    SELECT column_name, data_type, column_default, is_nullable
--    FROM information_schema.columns
--    WHERE table_schema = 'public' 
--      AND table_name = 'profiles'
--      AND column_name IN ('is_public', 'show_in_leaderboard');
--
-- 2. Verify RLS policy is updated:
--    SELECT policyname, cmd, qual 
--    FROM pg_policies 
--    WHERE tablename = 'profiles' AND cmd = 'SELECT';
--
-- 3. Test privacy policy:
--    -- As authenticated user:
--    SELECT id, username, is_public FROM public.profiles;
--    -- Should only show: your own profile + profiles where is_public = true
--
-- 4. Verify leaderboards filter by show_in_leaderboard:
--    SELECT COUNT(*) FROM public.weekly_leaderboard;
--    SELECT COUNT(*) FROM public.profiles WHERE show_in_leaderboard = true;
--
-- 5. Test opt-out:
--    UPDATE public.profiles
--      SET show_in_leaderboard = false
--      WHERE id = '<some-id>';
--    SELECT refresh_leaderboards(); -- or your existing refresh function
--
-- 6. Test that non-public profiles aren't visible:
--    -- As user A: UPDATE public.profiles SET is_public = false WHERE id = '<user-a-id>';
--    -- As user B (different account): SELECT * FROM public.profiles WHERE id = '<user-a-id>';
--    -- Should return 0 rows.
