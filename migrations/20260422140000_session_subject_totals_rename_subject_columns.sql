-- session_subject_totals: rename legacy parent_id / parent_name -> subject_id / subject_name
-- (Postgres rejects CREATE OR REPLACE when output column names change — use RENAME COLUMN.)
-- Flat subjects since 20260416180000; names now match semantics.

BEGIN;

ALTER VIEW public.session_subject_totals RENAME COLUMN parent_id TO subject_id;
ALTER VIEW public.session_subject_totals RENAME COLUMN parent_name TO subject_name;

COMMIT;
