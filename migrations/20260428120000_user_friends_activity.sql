-- Friends (pending | accepted) + SECURITY DEFINER RPC for pull-based activity feed.
-- Decline / cancel = DELETE row (no "declined" status — avoids unique-pair dead rows).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Table
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_friends_no_self CHECK (requester_id <> addressee_id)
);

COMMENT ON TABLE public.user_friends IS 'Directed friend request; one row per unordered pair (see unique index).';

CREATE UNIQUE INDEX user_friends_pair_unique ON public.user_friends (
  LEAST(requester_id, addressee_id),
  GREATEST(requester_id, addressee_id)
);

CREATE INDEX user_friends_requester_status_idx ON public.user_friends (requester_id, status);
CREATE INDEX user_friends_addressee_status_idx ON public.user_friends (addressee_id, status);

CREATE TRIGGER update_user_friends_updated_at
  BEFORE UPDATE ON public.user_friends
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Only addressee may accept (pending -> accepted). No other status transitions.
CREATE OR REPLACE FUNCTION public.enforce_user_friends_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.requester_id IS DISTINCT FROM NEW.requester_id
     OR OLD.addressee_id IS DISTINCT FROM NEW.addressee_id THEN
    RAISE EXCEPTION 'Cannot change friendship parties';
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      IF auth.uid() IS DISTINCT FROM OLD.addressee_id THEN
        RAISE EXCEPTION 'Only addressee can accept';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid friendship status change';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER user_friends_enforce_update
  BEFORE UPDATE ON public.user_friends
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_friends_update();

ALTER TABLE public.user_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_friends_select_own
  ON public.user_friends
  FOR SELECT
  TO authenticated
  USING (requester_id = (SELECT auth.uid()) OR addressee_id = (SELECT auth.uid()));

CREATE POLICY user_friends_insert_as_requester
  ON public.user_friends
  FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = (SELECT auth.uid()));

CREATE POLICY user_friends_update_involved
  ON public.user_friends
  FOR UPDATE
  TO authenticated
  USING (requester_id = (SELECT auth.uid()) OR addressee_id = (SELECT auth.uid()))
  WITH CHECK (requester_id = (SELECT auth.uid()) OR addressee_id = (SELECT auth.uid()));

CREATE POLICY user_friends_delete_involved
  ON public.user_friends
  FOR DELETE
  TO authenticated
  USING (requester_id = (SELECT auth.uid()) OR addressee_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_friends TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Activity feed (caller = auth.uid() only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friends_activity(
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  session_id uuid,
  friend_id uuid,
  friend_username text,
  friend_avatar_url text,
  subject_name text,
  subject_color text,
  subject_icon text,
  duration_seconds integer,
  started_at timestamptz,
  ended_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lim integer;
  v_off integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_lim := LEAST(200, GREATEST(1, COALESCE(p_limit, 30)));
  v_off := GREATEST(0, COALESCE(p_offset, 0));

  RETURN QUERY
  SELECT
    ss.id,
    p.id,
    p.username,
    p.avatar_url,
    s.name,
    s.color,
    s.icon,
    ss.duration_seconds,
    ss.started_at,
    ss.ended_at
  FROM public.study_sessions ss
  INNER JOIN public.profiles p ON p.id = ss.user_id
  INNER JOIN public.subjects s ON s.id = ss.subject_id
  WHERE ss.user_id IN (
    SELECT CASE
      WHEN uf.requester_id = v_uid THEN uf.addressee_id
      ELSE uf.requester_id
    END
    FROM public.user_friends uf
    WHERE (uf.requester_id = v_uid OR uf.addressee_id = v_uid)
      AND uf.status = 'accepted'
  )
  AND p.is_public = true
  AND s.deleted_at IS NULL
  AND COALESCE(s.is_active, true) = true
  AND ss.subject_id IS NOT NULL
  ORDER BY ss.ended_at DESC, ss.started_at DESC
  LIMIT v_lim
  OFFSET v_off;
END;
$$;

ALTER FUNCTION public.get_friends_activity(integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_friends_activity(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_friends_activity(integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Profiles: counterpart can read minimal row when a friendship exists
-- ---------------------------------------------------------------------------
CREATE POLICY "Profiles visible to friend counterpart"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_friends uf
      WHERE (uf.requester_id = (SELECT auth.uid()) AND uf.addressee_id = profiles.id)
         OR (uf.addressee_id = (SELECT auth.uid()) AND uf.requester_id = profiles.id)
    )
  );

COMMIT;
