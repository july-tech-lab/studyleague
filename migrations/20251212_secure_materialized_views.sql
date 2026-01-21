/* -----------------------------------------------------------------------------
  SECURE MATERIALIZED VIEWS (Materialized View in API)
  Date: 2025-12-12
  
  Fixes security warnings for materialized views that are accessible via Data API.
  Materialized views don't support RLS, so we revoke access from anonymous users.
  
  Authenticated users can still query these views directly for better performance.
  
  Based on Supabase Security Linter warnings:
  https://supabase.com/docs/guides/database/database-linter?lint=0016_materialized_view_in_api
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- REVOKE ANONYMOUS ACCESS TO MATERIALIZED VIEWS
  -----------------------------------------------------------------------------
  -- Materialized views don't support RLS, so we revoke access from anon.
  -- Authenticated users can still query these views directly if needed.
  -- 
  -- NOTE: Only revoking from 'anon' (not 'authenticated' or 'public') means:
  --   - Anonymous users cannot access materialized views (security)
  --   - Authenticated users can still access materialized views directly (performance)
  --   - Security warning may still appear for authenticated access, but that's acceptable
  --     if you want authenticated users to have direct access
  
  REVOKE ALL ON TABLE public.weekly_leaderboard FROM anon;
  REVOKE ALL ON TABLE public.monthly_leaderboard FROM anon;
  REVOKE ALL ON TABLE public.yearly_leaderboard FROM anon;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration:
-- 1. Verify materialized views are no longer accessible to anon:
--    SELECT grantee, privilege_type
--    FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' 
--      AND table_name IN ('weekly_leaderboard', 'monthly_leaderboard', 'yearly_leaderboard')
--      AND grantee = 'anon';
--    Should return no rows for anon
--
-- 2. Authenticated users can still query directly:
--    SELECT * FROM public.weekly_leaderboard LIMIT 10;
--    Should work for authenticated users
--
-- 3. Check Supabase Security Linter:
--    Warnings about anonymous access to materialized views should be resolved

