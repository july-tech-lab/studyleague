/* -----------------------------------------------------------------------------
  FIX SUPABASE SECURITY LINTER ISSUES
  Date: 2025-12-12
  
  Fixes:
  1. Enable RLS on tasks table (policies exist but RLS is disabled)
  2. Remove SECURITY DEFINER from session_overview view
  3. Remove SECURITY DEFINER from session_subject_totals view
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. ENABLE RLS ON TASKS TABLE
  -----------------------------------------------------------------------------
  -- The tasks table has RLS policies but RLS is not enabled
  -- This fixes: policy_exists_rls_disabled and rls_disabled_in_public
  -- FORCE ROW LEVEL SECURITY ensures even table owners are subject to RLS
  
  ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
  
  ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

  -----------------------------------------------------------------------------
  -- 2. FIX SESSION_OVERVIEW VIEW (Remove SECURITY DEFINER)
  -----------------------------------------------------------------------------
  -- Recreate the view with SECURITY INVOKER so it respects RLS policies
  -- This fixes: security_definer_view for session_overview
  
  CREATE OR REPLACE VIEW public.session_overview
  WITH (security_invoker = on) AS
  SELECT
    user_id,
    count(*) AS session_count,
    COALESCE(sum(duration_seconds), 0::bigint) AS total_seconds,
    COALESCE(
      sum(duration_seconds) FILTER (
        WHERE started_at >= date_trunc('month'::text, now())
      ),
      0::bigint
    ) AS month_seconds,
    COALESCE(avg(duration_seconds), 0::numeric) AS avg_seconds
  FROM public.study_sessions ss
  GROUP BY user_id;

  -----------------------------------------------------------------------------
  -- 3. FIX SESSION_SUBJECT_TOTALS VIEW (Remove SECURITY DEFINER)
  -----------------------------------------------------------------------------
  -- Recreate the view with SECURITY INVOKER so it respects RLS policies
  -- This fixes: security_definer_view for session_subject_totals
  
  CREATE OR REPLACE VIEW public.session_subject_totals
  WITH (security_invoker = on) AS
  WITH base AS (
    SELECT
      ss.user_id,
      ss.duration_seconds,
      ss.started_at,
      s.id AS subject_id,
      COALESCE(s.parent_subject_id, s.id) AS parent_id,
      COALESCE(parent.name, s.name) AS parent_name,
      (s.parent_subject_id IS NULL) AS is_root
    FROM public.study_sessions ss
    JOIN public.subjects s
      ON s.id = ss.subject_id
    LEFT JOIN public.subjects parent
      ON parent.id = s.parent_subject_id
  )
  SELECT
    user_id,
    parent_id,
    parent_name,
    COALESCE(sum(duration_seconds), 0::bigint) AS total_seconds,
    COALESCE(
      sum(duration_seconds) FILTER (WHERE is_root),
      0::bigint
    ) AS direct_seconds,
    COALESCE(
      sum(duration_seconds) FILTER (WHERE NOT is_root),
      0::bigint
    ) AS subtag_seconds
  FROM base
  GROUP BY user_id, parent_id, parent_name;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify:
-- 1. RLS is enabled: SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'tasks';
-- 2. Views don't have SECURITY DEFINER: 
--    SELECT viewname, viewowner FROM pg_views WHERE viewname IN ('session_overview', 'session_subject_totals');
--
-- Note: Views may still show as "UNRESTRICTED" in Supabase UI, but they are secure
-- because they use SECURITY INVOKER and respect the RLS policies of underlying tables.
-- The views query from study_sessions (which has RLS), so users will only see their own data.

