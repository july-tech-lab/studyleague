/* -----------------------------------------------------------------------------
  Sync triggers + RPC with production (2026-04-14)

  - handle_session_completed: UTC session date, XP = floor(duration/60), level /100,
    daily_summaries + streaks (no task logged_seconds here — client/RPC handles that)
  - handle_new_user: profile insert includes onboarding_completed = false
  - handle_task_completed_xp + on_task_completed_xp: +5 XP when task first becomes done
  - increment_task_seconds: atomic logged_seconds + status for linked task after session
  ----------------------------------------------------------------------------- */

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Session completion trigger (authoritative copy for fresh DBs / drift fix)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_session_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  last_day date;
  session_date date;
  has_studied_today boolean;
  xp_gain bigint;
BEGIN
  session_date := (new.started_at AT TIME ZONE 'UTC')::date;

  xp_gain := GREATEST(0, new.duration_seconds::bigint / 60);

  UPDATE public.profiles
  SET
    xp_total = xp_total + xp_gain,
    level = (1 + FLOOR((xp_total + xp_gain) / 100))::int
  WHERE id = new.user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.daily_summaries
    WHERE user_id = new.user_id AND date = session_date
  ) INTO has_studied_today;

  INSERT INTO public.daily_summaries (user_id, date, total_seconds)
  VALUES (new.user_id, session_date, new.duration_seconds)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_seconds = daily_summaries.total_seconds + excluded.total_seconds,
    updated_at = now();

  IF NOT has_studied_today THEN
    SELECT date INTO last_day
    FROM public.daily_summaries
    WHERE user_id = new.user_id
      AND date < session_date
    ORDER BY date DESC
    LIMIT 1;

    IF last_day = session_date - 1 THEN
      UPDATE public.profiles
      SET
        current_streak = current_streak + 1,
        longest_streak = GREATEST(longest_streak, current_streak + 1)
      WHERE id = new.user_id;
    ELSE
      UPDATE public.profiles
      SET
        current_streak = 1,
        longest_streak = GREATEST(longest_streak, 1)
      WHERE id = new.user_id;
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Auth signup → profile (onboarding flag)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, onboarding_completed)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User_' || substr(new.id::text, 1, 6)),
    'https://api.dicebear.com/7.x/notionists/svg?seed=' || new.id,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Task completed → small XP bonus (first transition to done)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_task_completed_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  bonus bigint := 5;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    UPDATE public.profiles
    SET
      xp_total = xp_total + bonus,
      level = (1 + FLOOR((xp_total + bonus) / 100))::int
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_completed_xp ON public.tasks;
CREATE TRIGGER on_task_completed_xp
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_completed_xp();

-- ---------------------------------------------------------------------------
-- 4. RPC: app calls after insert study_sessions (utils/queries logSession)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_task_seconds(
  task_id_input uuid,
  seconds_to_add integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF seconds_to_add < 0 OR seconds_to_add > 86400 THEN
    RAISE EXCEPTION 'seconds_to_add out of allowed range';
  END IF;

  UPDATE public.tasks
  SET
    logged_seconds = logged_seconds + seconds_to_add,
    status = CASE
      WHEN status = 'done'::public.task_status THEN status
      ELSE 'in-progress'::public.task_status
    END,
    updated_at = now()
  WHERE id = task_id_input
    AND user_id = auth.uid()
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found, not owned by user, or deleted';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_task_seconds(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_task_seconds(uuid, integer) TO anon;

COMMIT;
