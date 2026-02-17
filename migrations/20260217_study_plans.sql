/* -----------------------------------------------------------------------------
  STUDY PLANS - Recurring study schedules for subjects over time
  
  Date: 2026-02-17
  
  Adds study_plans table for recurring study schedules, e.g.:
  - "Study maths 2hrs per week every Monday"
  - "Except June–July"
  - "Until Sept 2027"
  
  This is distinct from tasks: tasks are one-off items (e.g. "Study for test #3").
  Study plans define recurring rules; they can feed into the planner or generate
  suggested sessions.
  -----------------------------------------------------------------------------
*/

BEGIN;

-- 1. Create study_plans table
CREATE TABLE public.study_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  minutes_per_week integer NOT NULL CHECK (minutes_per_week > 0),
  -- Days of week: 0=Sunday, 1=Monday, ..., 6=Saturday
  -- e.g. [1] = Mondays only, [1,3,5] = Mon/Wed/Fri
  days_of_week smallint[] NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  -- Excluded date ranges: e.g. holidays, summer break
  -- Format: [{"start":"2025-06-01","end":"2025-07-31"}]
  excluded_ranges jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_plans_days_valid CHECK (
    days_of_week <@ ARRAY[0,1,2,3,4,5,6]::smallint[] AND
    array_length(days_of_week, 1) > 0
  ),
  CONSTRAINT study_plans_date_order CHECK (
    end_date IS NULL OR end_date >= start_date
  )
);

COMMENT ON TABLE public.study_plans IS 'Recurring study schedules per subject (e.g. 2hrs/week on Mondays until Sept 2027, except June-July)';
COMMENT ON COLUMN public.study_plans.minutes_per_week IS 'Total minutes to study this subject per week across all selected days';
COMMENT ON COLUMN public.study_plans.days_of_week IS 'Array of weekday numbers: 0=Sun,1=Mon,...,6=Sat';
COMMENT ON COLUMN public.study_plans.excluded_ranges IS 'JSON array of {start,end} date ranges to exclude (e.g. holidays)';

-- 2. Trigger for updated_at
CREATE TRIGGER trg_study_plans_updated
  BEFORE UPDATE ON public.study_plans
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 3. Indexes
CREATE INDEX idx_study_plans_user ON public.study_plans(user_id);
CREATE INDEX idx_study_plans_subject ON public.study_plans(subject_id);
CREATE INDEX idx_study_plans_active_dates ON public.study_plans(user_id, start_date, end_date)
  WHERE is_active = true;

-- 4. Enable RLS
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies
CREATE POLICY "Users can view own study plans"
  ON public.study_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study plans"
  ON public.study_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study plans"
  ON public.study_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own study plans"
  ON public.study_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Helper function: compute planned occurrences for a date range
-- Returns table of (planned_date, subject_id, minutes, plan_id)
-- Useful for calendar/week view or generating suggested tasks
CREATE OR REPLACE FUNCTION public.study_plan_occurrences(
  p_user_id uuid,
  p_from_date date,
  p_to_date date
)
RETURNS TABLE (
  planned_date date,
  subject_id uuid,
  minutes integer,
  plan_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  d date;
  dow integer; -- 0=Sun, 1=Mon, ...
  in_exclusion boolean;
  excl jsonb;
  excl_start date;
  excl_end date;
  mins_per_day integer;
BEGIN
  FOR rec IN
    SELECT sp.id, sp.subject_id, sp.minutes_per_week, sp.days_of_week,
           sp.start_date, sp.end_date, sp.excluded_ranges
    FROM public.study_plans sp
    WHERE sp.user_id = p_user_id
      AND sp.is_active
      AND sp.start_date <= p_to_date
      AND (sp.end_date IS NULL OR sp.end_date >= p_from_date)
  LOOP
    -- Minutes per occurrence: distribute evenly across selected days
    mins_per_day := rec.minutes_per_week / array_length(rec.days_of_week, 1);

    FOR d IN SELECT generate_series(
      GREATEST(rec.start_date, p_from_date),
      LEAST(COALESCE(rec.end_date, p_to_date), p_to_date),
      '1 day'::interval
    )::date
    LOOP
      dow := EXTRACT(DOW FROM d)::integer; -- 0=Sun, 1=Mon, ..., 6=Sat
      IF dow = ANY(rec.days_of_week) THEN
        -- Check exclusions
        in_exclusion := false;
        FOR excl IN SELECT * FROM jsonb_array_elements(rec.excluded_ranges)
        LOOP
          excl_start := (excl->>'start')::date;
          excl_end := (excl->>'end')::date;
          IF d >= excl_start AND d <= excl_end THEN
            in_exclusion := true;
            EXIT;
          END IF;
        END LOOP;
        IF NOT in_exclusion THEN
          planned_date := d;
          subject_id := rec.subject_id;
          minutes := mins_per_day;
          plan_id := rec.id;
          RETURN NEXT;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.study_plan_occurrences IS 'Returns planned study dates for a user within a date range, respecting exclusions';

-- Grant execute to authenticated users
REVOKE ALL ON FUNCTION public.study_plan_occurrences FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.study_plan_occurrences TO authenticated;

COMMIT;
