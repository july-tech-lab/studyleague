-- YPT-style subjects: each user owns their subject rows (name/color/order editable).
-- Duplicates every *referenced* global subject (owner_id IS NULL) into a user-owned row
-- and rewires FKs. Re-runnable: once rewired, rows no longer join to globals in the driver query.
--
-- Run in Supabase SQL Editor (postgres) BEFORE deploying the client that only lists
-- user-owned subjects in fetchSubjects.

BEGIN;

CREATE OR REPLACE FUNCTION public._migration_detach_global_for_user(p_user_id uuid, p_global_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_src public.subjects%ROWTYPE;
  v_new_id uuid;
  v_us_updated int;
BEGIN
  SELECT * INTO STRICT v_src FROM public.subjects s WHERE s.id = p_global_id AND s.owner_id IS NULL;

  INSERT INTO public.subjects (
    name,
    slug,
    icon,
    color,
    owner_id,
    bank_key,
    is_active,
    created_at,
    updated_at,
    deleted_at
  )
  VALUES (
    v_src.name,
    v_src.slug,
    v_src.icon,
    v_src.color,
    p_user_id,
    v_src.bank_key,
    v_src.is_active,
    now(),
    now(),
    v_src.deleted_at
  )
  RETURNING id INTO v_new_id;

  UPDATE public.user_subjects us
  SET subject_id = v_new_id
  WHERE us.user_id = p_user_id
    AND us.subject_id = p_global_id;
  GET DIAGNOSTICS v_us_updated = ROW_COUNT;

  IF v_us_updated = 0 THEN
    INSERT INTO public.user_subjects (user_id, subject_id, is_hidden)
    VALUES (p_user_id, v_new_id, false)
    ON CONFLICT (user_id, subject_id) DO NOTHING;
  END IF;

  UPDATE public.study_sessions ss
  SET subject_id = v_new_id
  WHERE ss.user_id = p_user_id
    AND ss.subject_id = p_global_id;

  UPDATE public.tasks t
  SET subject_id = v_new_id
  WHERE t.user_id = p_user_id
    AND t.subject_id = p_global_id;

  UPDATE public.subject_weekly_goals g
  SET subject_id = v_new_id
  WHERE g.user_id = p_user_id
    AND g.subject_id = p_global_id;

  RETURN v_new_id;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT x.user_id, x.subject_id AS global_id
    FROM (
      SELECT us.user_id, us.subject_id FROM public.user_subjects us
      UNION
      SELECT ss.user_id, ss.subject_id FROM public.study_sessions ss WHERE ss.subject_id IS NOT NULL
      UNION
      SELECT t.user_id, t.subject_id FROM public.tasks t WHERE t.subject_id IS NOT NULL
      UNION
      SELECT g.user_id, g.subject_id FROM public.subject_weekly_goals g
    ) x
    INNER JOIN public.subjects s ON s.id = x.subject_id AND s.owner_id IS NULL
  LOOP
    PERFORM public._migration_detach_global_for_user(r.user_id, r.global_id);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public._migration_detach_global_for_user(uuid, uuid);

-- Soft-delete global subjects that nothing references anymore (keeps DB tidy).
UPDATE public.subjects g
SET deleted_at = COALESCE(g.deleted_at, now())
WHERE g.owner_id IS NULL
  AND g.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_subjects us WHERE us.subject_id = g.id)
  AND NOT EXISTS (SELECT 1 FROM public.study_sessions ss WHERE ss.subject_id = g.id)
  AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.subject_id = g.id)
  AND NOT EXISTS (SELECT 1 FROM public.subject_weekly_goals wg WHERE wg.subject_id = g.id);

COMMENT ON TABLE public.subjects IS 'User-owned study subjects (onboarding copies from the app catalog). Legacy global rows (owner_id IS NULL) are deprecated.';

COMMIT;
