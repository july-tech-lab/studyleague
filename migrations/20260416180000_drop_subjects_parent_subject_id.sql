-- Drop subjects.parent_subject_id (unused hierarchy).
-- 1) Recreate session_subject_totals without parent join (each subject is its own "root").
-- 2) Drop self-FK and index, then column.

BEGIN;

CREATE OR REPLACE VIEW public.session_subject_totals
WITH (security_invoker = on) AS
WITH base AS (
  SELECT
    ss.user_id,
    ss.duration_seconds,
    ss.started_at,
    s.id AS subject_id,
    s.id AS parent_id,
    s.name AS parent_name,
    true AS is_root
  FROM public.study_sessions ss
  JOIN public.subjects s
    ON s.id = ss.subject_id
    AND s.deleted_at IS NULL
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

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_parent_subject_id_fkey;

DROP INDEX IF EXISTS public.subjects_parent_subject_id_idx;

ALTER TABLE public.subjects
  DROP COLUMN IF EXISTS parent_subject_id;

COMMIT;
