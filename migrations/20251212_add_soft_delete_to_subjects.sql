/* -----------------------------------------------------------------------------
  ADD SOFT DELETE TO SUBJECTS
  Date: 2025-12-12
  
  Implements soft delete pattern for subjects to preserve data integrity
  and allow recovery of deleted subjects.
  
  Changes:
  1. Add deleted_at timestamp column to subjects table
  2. Create index for filtering active (non-deleted) subjects
  3. Update deleteSubject function to use soft delete instead of hard delete
  4. Update fetchSubjects query to filter deleted_at IS NULL
  5. Update RLS policies if needed
  
  Benefits:
  - Preserves all relationships (study_sessions, tasks, user_subjects)
  - Prevents orphaned study sessions
  - Allows recovery of accidentally deleted subjects
  - Consistent with tasks table soft delete pattern
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. ADD deleted_at COLUMN TO SUBJECTS
  -----------------------------------------------------------------------------
  
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'subjects'
        AND column_name = 'deleted_at'
    ) THEN
      ALTER TABLE public.subjects
        ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;
      
      -- Create index for filtering active (non-deleted) subjects
      -- This is especially useful for queries filtering by owner_id and deleted_at
      CREATE INDEX IF NOT EXISTS idx_subjects_deleted_at
        ON public.subjects(owner_id, deleted_at)
        WHERE deleted_at IS NULL;
      
      -- Also create a general index for global subjects (owner_id IS NULL)
      CREATE INDEX IF NOT EXISTS idx_subjects_global_deleted_at
        ON public.subjects(deleted_at)
        WHERE owner_id IS NULL AND deleted_at IS NULL;
      
      RAISE NOTICE '✓ Soft delete column added to subjects';
    ELSE
      RAISE NOTICE '⚠️  deleted_at column already exists on subjects';
    END IF;
  END $$;

  -----------------------------------------------------------------------------
  -- 2. UPDATE VIEWS TO FILTER DELETED SUBJECTS
  -----------------------------------------------------------------------------
  
  -- Update session_subject_totals view to exclude deleted subjects
  -- This ensures statistics don't include data from deleted subjects
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
      AND s.deleted_at IS NULL  -- Exclude deleted subjects
    LEFT JOIN public.subjects parent
      ON parent.id = s.parent_subject_id
      AND parent.deleted_at IS NULL  -- Exclude deleted parent subjects
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

  -----------------------------------------------------------------------------
  -- 3. ADD COMMENT FOR DOCUMENTATION
  -----------------------------------------------------------------------------
  
  COMMENT ON COLUMN public.subjects.deleted_at IS 
    'Soft delete timestamp. NULL means subject is active. Set to timestamp when subject is deleted.';

COMMIT;

