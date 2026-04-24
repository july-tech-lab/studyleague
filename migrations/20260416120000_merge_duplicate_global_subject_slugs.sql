-- -----------------------------------------------------------------------------
-- Merge duplicate global subjects (same slug, two catalogue rows).
-- Context: legacy FR rows (no bank_key) + newer EN bank rows from 2026-04.
-- Repoints FKs then soft-deletes the deprecated row.
-- Run once in Supabase SQL Editor after backup / verification.
-- -----------------------------------------------------------------------------

BEGIN;

-- (old_subject_id, canonical_subject_id) — keep canonical (bank_key + app catalogue)
CREATE TEMP TABLE _subject_slug_merge (old_id uuid, new_id uuid) ON COMMIT DROP;
INSERT INTO _subject_slug_merge (old_id, new_id) VALUES
  ('6c5001b1-1d3b-4472-a5e2-c60a26831e64', 'e75711b4-076c-4a5b-9ee8-ccf29b6c3136'), -- chinese
  ('a565ea51-4d29-49b1-8bb9-47258368f94e', '70709bab-8cb0-49fb-a40b-3900b50069b0'), -- german
  ('a0588a3c-45d6-45bf-8e0d-68a582b3d8a4', 'd4f022c5-0e1f-4bda-a2be-b6284efbd4d3'), -- italian
  ('aa5a3b28-a325-4436-9a4f-0c96992baefe', '4d98f17a-449a-41d2-803f-86980e2944f0'), -- philosophy
  ('66d7fb08-fcce-4dc5-bfc3-cb855b4d07b0', '115cc14f-033d-447b-9c5e-80f5137e288e'), -- spanish
  ('d4dfc500-b6ec-4f5e-aa40-8138966bb53e', 'a6773afe-5987-4627-9ea7-e02a41317fc0'); -- technology

-- subject_weekly_goals: UNIQUE (user_id, subject_id, day_of_week) — drop old row if target already has that day
DELETE FROM public.subject_weekly_goals g
USING _subject_slug_merge m,
  public.subject_weekly_goals g_keep
WHERE g.subject_id = m.old_id
  AND g_keep.subject_id = m.new_id
  AND g_keep.user_id = g.user_id
  AND g_keep.day_of_week = g.day_of_week;

UPDATE public.subject_weekly_goals g
SET subject_id = m.new_id
FROM _subject_slug_merge m
WHERE g.subject_id = m.old_id;

UPDATE public.tasks t
SET subject_id = m.new_id
FROM _subject_slug_merge m
WHERE t.subject_id = m.old_id;

UPDATE public.study_sessions ss
SET subject_id = m.new_id
FROM _subject_slug_merge m
WHERE ss.subject_id = m.old_id;

-- user_subjects PK (user_id, subject_id): drop old membership if user already has canonical
DELETE FROM public.user_subjects us
USING _subject_slug_merge m
WHERE us.subject_id = m.old_id
  AND EXISTS (
    SELECT 1
    FROM public.user_subjects us2
    WHERE us2.user_id = us.user_id
      AND us2.subject_id = m.new_id
  );

UPDATE public.user_subjects us
SET subject_id = m.new_id
FROM _subject_slug_merge m
WHERE us.subject_id = m.old_id;

-- Soft-delete deprecated global rows (preserve id for audit)
UPDATE public.subjects s
SET
  deleted_at = coalesce(s.deleted_at, now()),
  is_active = false,
  updated_at = now()
FROM _subject_slug_merge m
WHERE s.id = m.old_id;

COMMIT;
