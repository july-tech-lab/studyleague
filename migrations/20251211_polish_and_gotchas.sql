/* -----------------------------------------------------------------------------
  POLISH & GOTCHAS - Final Touches
  Date: 2025-12-11
  
  Addresses:
  1. Relax logged_seconds constraint (allow reducing planned_minutes after logging)
  2. Validate hex color constraint (if data is clean)
  3. Initial leaderboard population
  4. Documentation for FK patterns and pg_cron setup
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. RELAX: logged_seconds <= planned_minutes Constraint
  -----------------------------------------------------------------------------
  -- Issue: If user reduces planned_minutes after logging time, UPDATE fails
  -- Solution: Only enforce on INSERT, allow flexibility on UPDATE
  --           OR: Allow logged_seconds to exceed planned_minutes (user over-delivered)
  
  -- Option A: Remove constraint entirely (logged can exceed planned - that's OK!)
  -- This is actually a feature: users can log more time than planned (over-delivery)
  ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS check_logged_vs_planned;
  
  -- Option B (if you want to keep some validation): Only check on INSERT
  -- We'll go with Option A since over-delivery is a valid scenario
  
  COMMENT ON COLUMN public.tasks.logged_seconds IS 
    'Total seconds logged across all linked study sessions (auto-updated by trigger). Can exceed planned_minutes if user over-delivers.';

  -----------------------------------------------------------------------------
  -- 2. VALIDATE: Hex Color Constraint (if data is clean)
  -----------------------------------------------------------------------------
  -- The constraint is NOT VALID, meaning it only checks new rows
  -- If you're confident all existing rows are valid, validate it:
  
  -- First, check for any invalid colors
  DO $$
  DECLARE
    invalid_count int;
  BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM public.subjects
    WHERE color IS NOT NULL 
      AND color !~* '^#[a-f0-9]{6}$';
    
    IF invalid_count > 0 THEN
      RAISE WARNING 'Found % subject(s) with invalid hex colors. Fix them before validating constraint.', invalid_count;
      RAISE NOTICE 'Run: SELECT id, name, color FROM public.subjects WHERE color IS NOT NULL AND color !~* ''^#[a-f0-9]{6}$'';';
    ELSE
      -- All colors are valid, validate the constraint
      ALTER TABLE public.subjects
        VALIDATE CONSTRAINT check_hex_color;
      
      RAISE NOTICE '✓ Hex color constraint validated';
    END IF;
  END$$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION SETUP (Run these manually after migration)
-- ============================================================================

-- 1. SET UP PG_CRON FOR LEADERBOARD REFRESH
--    (Only if pg_cron extension is enabled in Supabase)
--    
--    SELECT cron.schedule(
--      'refresh-leaderboards-hourly',
--      '0 * * * *',  -- Every hour at minute 0
--      'SELECT public.refresh_leaderboards();'
--    );
--
--    To check if it's scheduled:
--    SELECT * FROM cron.job WHERE jobname = 'refresh-leaderboards-hourly';
--
--    To unschedule:
--    SELECT cron.unschedule('refresh-leaderboards-hourly');


-- 2. SET UP PG_CRON FOR TASK CLEANUP
--    (Only if pg_cron extension is enabled in Supabase)
--
--    SELECT cron.schedule(
--      'cleanup-deleted-tasks-daily',
--      '0 3 * * *',  -- Daily at 3 AM
--      'SELECT public.cleanup_deleted_tasks();'
--    );


-- ============================================================================
-- DOCUMENTATION: Foreign Key Patterns
-- ============================================================================
/*
  FOREIGN KEY REFERENCE PATTERNS:
  
  → auth.users (direct):
     - tasks.user_id
     - groups.created_by  
     - group_members.user_id
     
     Why: Convenient for RLS (auth.uid() works directly)
     Note: Same UUID as profiles.id, so joins work fine
  
  → public.profiles (via profiles.id = auth.users.id):
     - study_sessions.user_id
     - daily_summaries.user_id
     - subscriptions.user_id
     - subjects.owner_id
     - user_subjects.user_id
     
     Why: These tables benefit from cascade delete through profiles
     Note: profiles.id is FK to auth.users.id, so it's the same UUID
  
  JOIN PATTERNS:
  
  -- For timer UI (profiles ↔ tasks):
  SELECT p.*, t.*
  FROM public.profiles p
  JOIN public.tasks t ON t.user_id = p.id;  -- Works because same UUID
  
  -- For RLS checks:
  WHERE auth.uid() = tasks.user_id;  -- Direct, no join needed
  WHERE auth.uid() = profiles.id;    -- Direct, no join needed
*/

-- ============================================================================
-- NOTES ON CONSTRAINT CHANGES
-- ============================================================================
/*
  REMOVED: check_logged_vs_planned constraint
  
  Reason: Users might reduce planned_minutes after logging time
          Also, over-delivery (logging more than planned) is valid
  
  If you want to re-add with INSERT-only validation, use a trigger:
  
  CREATE OR REPLACE FUNCTION public.check_planned_on_insert()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF NEW.planned_minutes IS NOT NULL 
       AND NEW.logged_seconds > (NEW.planned_minutes * 60) THEN
      RAISE EXCEPTION 'logged_seconds (%) cannot exceed planned_minutes (%) on insert',
        NEW.logged_seconds, NEW.planned_minutes * 60;
    END IF;
    RETURN NEW;
  END;
  $$;
  
  CREATE TRIGGER trg_check_planned_on_insert
    BEFORE INSERT ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.check_planned_on_insert();
*/

