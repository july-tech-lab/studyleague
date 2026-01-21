/* -----------------------------------------------------------------------------
  CHATGPT SUGGESTED IMPROVEMENTS
  Date: 2025-12-11
  Based on: ChatGPT's comprehensive database review
  
  Priority improvements:
  1. Remove unused streak_count column (quick win)
  2. Tighten RLS - remove public read on raw data (security)
  3. Add subjects uniqueness constraint (data integrity)
  4. Convert status to enums (type safety)
  5. Add member_count to groups (performance)
  
  Note: User reference unification (#1) is a larger refactor - 
        consider doing separately after testing these changes.
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. CLEANUP: Remove Unused streak_count Column
  -----------------------------------------------------------------------------
  -- Issue: daily_summaries.streak_count is never updated (streak logic is in profiles)
  -- This creates ambiguity and potential for bugs
  
  ALTER TABLE public.daily_summaries
    DROP COLUMN IF EXISTS streak_count;

  -----------------------------------------------------------------------------
  -- 2. SECURITY: Tighten RLS - Remove Public Read on Raw Data
  -----------------------------------------------------------------------------
  -- Issue: Public can read all study_sessions and daily_summaries
  -- This exposes personal behavior data (what/when someone studied, notes)
  -- Solution: Keep leaderboard materialized views as public interface
  
  -- Remove global read on study_sessions
  DROP POLICY IF EXISTS "Read all sessions" ON public.study_sessions;
  
  -- Add policy for users to read only their own sessions
  CREATE POLICY "Users can read own sessions"
    ON public.study_sessions
    FOR SELECT
    USING (auth.uid() = user_id);
  
  -- Remove global read on daily_summaries
  DROP POLICY IF EXISTS "Public read (leaderboards)" ON public.daily_summaries;
  
  -- Add policy for users to read only their own daily summaries
  CREATE POLICY "Users can read own daily summaries"
    ON public.daily_summaries
    FOR SELECT
    USING (auth.uid() = user_id);
  
  -- Note: Leaderboard materialized views remain public (they're aggregated data)

  -----------------------------------------------------------------------------
  -- 3. DATA INTEGRITY: Add Subjects Uniqueness Constraint
  -----------------------------------------------------------------------------
  -- Issue: No uniqueness on (owner_id, name) - allows duplicates like "Maths", "maths", "MATHS"
  -- Solution: Case-insensitive uniqueness per owner
  
  -- First, check for existing duplicates
  DO $$
  DECLARE
    duplicate_count int;
  BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
      SELECT owner_id, lower(name), COUNT(*) as cnt
      FROM public.subjects
      WHERE name IS NOT NULL
      GROUP BY owner_id, lower(name)
      HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
      RAISE WARNING 'Found % duplicate subject name(s). These need to be resolved before adding unique constraint.', duplicate_count;
      RAISE NOTICE 'Run this query to find duplicates:';
      RAISE NOTICE 'SELECT owner_id, lower(name), COUNT(*) FROM public.subjects WHERE name IS NOT NULL GROUP BY owner_id, lower(name) HAVING COUNT(*) > 1;';
    ELSE
      -- Create unique, case-insensitive constraint per owner
      CREATE UNIQUE INDEX IF NOT EXISTS subjects_owner_name_unique
        ON public.subjects (owner_id, LOWER(name))
        WHERE name IS NOT NULL;
      
      RAISE NOTICE '✓ Subjects uniqueness constraint added';
    END IF;
  END$$;

  -----------------------------------------------------------------------------
  -- 4. TYPE SAFETY: Convert Task Status to Enum
  -----------------------------------------------------------------------------
  -- Issue: Status is free text with CHECK constraint - prone to typos
  -- Solution: Use enum for type safety and cleaner TypeScript mapping
  
  -- Create enum type
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
      CREATE TYPE public.task_status AS ENUM ('planned', 'in-progress', 'done');
    END IF;
  END$$;
  
  -- Convert existing status column to enum
  -- Step 1: Drop indexes with WHERE clauses that reference status (they'll break after type conversion)
  DROP INDEX IF EXISTS public.idx_tasks_active;
  DROP INDEX IF EXISTS public.idx_tasks_completed;
  
  -- Step 2: Drop the default (can't convert type with default)
  ALTER TABLE public.tasks
    ALTER COLUMN status DROP DEFAULT;
  
  -- Step 3: Drop CHECK constraint (will be replaced by enum)
  ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_status_check;
  
  -- Step 4: Convert column type (this will fail if there are invalid status values)
  ALTER TABLE public.tasks
    ALTER COLUMN status TYPE public.task_status
    USING status::public.task_status;
  
  -- Step 5: Restore the default with enum type
  ALTER TABLE public.tasks
    ALTER COLUMN status SET DEFAULT 'planned'::public.task_status;
  
  -- Step 6: Recreate indexes with enum type in WHERE clauses
  CREATE INDEX IF NOT EXISTS idx_tasks_active
    ON public.tasks(user_id, scheduled_for)
    WHERE ((status = ANY (ARRAY['planned'::public.task_status, 'in-progress'::public.task_status])) 
           AND scheduled_for IS NOT NULL);
  
  CREATE INDEX IF NOT EXISTS idx_tasks_completed
    ON public.tasks(user_id, updated_at DESC)
    WHERE (status = 'done'::public.task_status);

  -----------------------------------------------------------------------------
  -- 5. TYPE SAFETY: Convert Subscription Status to Enum
  -----------------------------------------------------------------------------
  -- Issue: Status is free text - prone to typos and inconsistent values
  -- Solution: Use enum aligned with Stripe subscription statuses
  
  -- Create enum type
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
      CREATE TYPE public.subscription_status AS ENUM (
        'trialing',
        'active',
        'past_due',
        'canceled',
        'incomplete',
        'incomplete_expired'
      );
    END IF;
  END$$;
  
  -- Convert existing status column to enum
  -- Step 1: Check for invalid values and map them
  DO $$
  DECLARE
    invalid_count int;
  BEGIN
    -- Count invalid status values
    SELECT COUNT(*) INTO invalid_count
    FROM public.subscriptions
    WHERE status NOT IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired');
    
    IF invalid_count > 0 THEN
      RAISE WARNING 'Found % subscription(s) with invalid status. Mapping to ''active''.', invalid_count;
      -- Map invalid values to 'active' (or adjust as needed)
      UPDATE public.subscriptions
      SET status = 'active'
      WHERE status NOT IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired');
    END IF;
  END$$;
  
  -- Step 2: Drop the default (if it exists)
  ALTER TABLE public.subscriptions
    ALTER COLUMN status DROP DEFAULT;
  
  -- Step 3: Convert column type
  ALTER TABLE public.subscriptions
    ALTER COLUMN status TYPE public.subscription_status
    USING status::public.subscription_status;
  
  -- Step 4: Set default (if subscriptions table has a default, adjust as needed)
  -- Note: subscriptions table might not have a default, so this is optional
  -- ALTER TABLE public.subscriptions
  --   ALTER COLUMN status SET DEFAULT 'active'::public.subscription_status;

  -----------------------------------------------------------------------------
  -- 6. PERFORMANCE: Add member_count to Groups
  -----------------------------------------------------------------------------
  -- Issue: Counting group members requires aggregation query
  -- Solution: Cache member_count for "popular groups" queries
  
  -- Add column
  ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 0 NOT NULL;
  
  -- Initialize with current counts
  UPDATE public.groups g
  SET member_count = (
    SELECT COUNT(*)
    FROM public.group_members gm
    WHERE gm.group_id = g.id
      AND gm.status = 'approved'
  );
  
  -- Create function to update member_count
  CREATE OR REPLACE FUNCTION public.update_group_member_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
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
  
  -- Create trigger
  DROP TRIGGER IF EXISTS trg_update_group_member_count ON public.group_members;
  
  CREATE TRIGGER trg_update_group_member_count
    AFTER INSERT OR UPDATE OR DELETE ON public.group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_group_member_count();
  
  -- Create index for "popular groups" queries
  CREATE INDEX IF NOT EXISTS idx_groups_member_count
    ON public.groups(member_count DESC, created_at DESC);

  -----------------------------------------------------------------------------
  -- 7. OPTIONAL: Add Stripe Fields to Subscriptions
  -----------------------------------------------------------------------------
  -- Uncomment if you're using Stripe for billing
  
  /*
  ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS stripe_customer_id text,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
  
  -- Add indexes for Stripe lookups
  CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
    ON public.subscriptions(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;
  
  CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription
    ON public.subscriptions(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;
  */

COMMIT;

-- ============================================================================
-- POST-MIGRATION ACTIONS
-- ============================================================================

-- 1. If subject duplicates were found, resolve them:
--    Option A: Keep first, rename others
--    UPDATE public.subjects s1
--    SET name = name || '_' || substr(s1.id::text, 1, 4)
--    WHERE EXISTS (
--      SELECT 1 FROM public.subjects s2
--      WHERE s2.owner_id = s1.owner_id
--        AND lower(s2.name) = lower(s1.name)
--        AND s2.id < s1.id
--    );
--
--    Option B: Let users choose new names (better UX)

-- 2. If task status conversion failed, check for invalid values:
--    SELECT DISTINCT status FROM public.tasks WHERE status NOT IN ('planned', 'in-progress', 'done');
--    Then map them before running the migration

-- 3. If subscription status conversion failed, check for invalid values:
--    SELECT DISTINCT status FROM public.subscriptions;
--    Then map them to valid enum values before running the migration

-- 4. Verify member_count is working:
--    SELECT id, name, member_count FROM public.groups ORDER BY member_count DESC LIMIT 10;
--    Then add/remove a member and verify count updates

-- ============================================================================
-- NOTES ON DEFERRED IMPROVEMENTS
-- ============================================================================

-- ⚠️  User Reference Unification (#1 from ChatGPT)
-- This is a larger refactor that requires:
--   1. Changing foreign keys (tasks, groups, group_members)
--   2. Updating all RLS policies
--   3. Migrating existing data
--   4. Testing thoroughly
--
-- Recommendation: Do this as a separate migration after testing current changes.
-- It's a good improvement but not urgent - current setup works fine.

-- ⚠️  Subjects Slug Uniqueness
-- If you add slug column later:
--    ALTER TABLE public.subjects ADD COLUMN slug text;
--    CREATE UNIQUE INDEX subjects_owner_slug_unique
--      ON public.subjects (owner_id, slug)
--      WHERE slug IS NOT NULL;

-- ⚠️  Materialized View Refresh Optimization
-- Current: refresh_leaderboards() called in trigger (can be slow at scale)
-- Future: Consider scheduled refresh or debounce mechanism
--    - Use pg_cron for periodic refresh
--    - Or add "last_refreshed_at" flag to skip if refreshed recently

