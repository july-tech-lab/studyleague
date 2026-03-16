/* -----------------------------------------------------------------------------
  SUBJECT WEEKLY GOALS - Per-day study time goals per subject
  
  Date: 2026-02-17
  
  Stores study time goals per subject per day of week (Mon-Sun).
  Used by the Goals page to let users set e.g. "1h Maths on Mon, 1h30 on Wed".
  -----------------------------------------------------------------------------
*/

BEGIN;

CREATE TABLE public.subject_weekly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  minutes integer NOT NULL DEFAULT 0 CHECK (minutes >= 0 AND minutes <= 480),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject_id, day_of_week)
);

COMMENT ON TABLE public.subject_weekly_goals IS 'Per-day study time goals per subject (0=Sun, 1=Mon, ..., 6=Sat)';
COMMENT ON COLUMN public.subject_weekly_goals.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN public.subject_weekly_goals.minutes IS 'Goal minutes for this subject on this day (0-480)';

CREATE TRIGGER trg_subject_weekly_goals_updated
  BEFORE UPDATE ON public.subject_weekly_goals
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX idx_subject_weekly_goals_user ON public.subject_weekly_goals(user_id);
CREATE INDEX idx_subject_weekly_goals_subject ON public.subject_weekly_goals(subject_id);

ALTER TABLE public.subject_weekly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly goals"
  ON public.subject_weekly_goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly goals"
  ON public.subject_weekly_goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly goals"
  ON public.subject_weekly_goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly goals"
  ON public.subject_weekly_goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
