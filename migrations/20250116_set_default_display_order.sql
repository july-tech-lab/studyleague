-- Migration: Set default display_order for existing user_subjects
-- This sets display_order based on alphabetical order of subject names
-- for users who don't have a custom order yet

-- Update display_order for user_subjects that don't have one set
-- Order by subject name alphabetically within each user
UPDATE public.user_subjects us
SET display_order = sub.row_num
FROM (
  SELECT 
    us2.user_id,
    us2.subject_id,
    ROW_NUMBER() OVER (PARTITION BY us2.user_id ORDER BY s.name ASC) as row_num
  FROM public.user_subjects us2
  INNER JOIN public.subjects s ON us2.subject_id = s.id
  WHERE us2.display_order IS NULL
    AND us2.is_hidden = false
) sub
WHERE us.user_id = sub.user_id
  AND us.subject_id = sub.subject_id
  AND us.display_order IS NULL;

-- Comment
COMMENT ON COLUMN public.user_subjects.display_order IS 
  'User-defined display order for subjects. Lower numbers appear first. NULL means use default (alphabetical).';
