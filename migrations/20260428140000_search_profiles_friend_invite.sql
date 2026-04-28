-- Friend-invite search: find users by username substring without requiring is_public.
-- Direct .from('profiles') cannot return private rows for other users (RLS + old is_public filter).

BEGIN;

CREATE OR REPLACE FUNCTION public.search_profiles_for_friend_invite(
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lim integer;
  v_trim text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_trim := trim(p_query);
  IF length(v_trim) < 3 THEN
    RETURN;
  END IF;

  v_lim := LEAST(50, GREATEST(1, COALESCE(p_limit, 20)));

  RETURN QUERY
  SELECT p.id, p.username, p.avatar_url
  FROM public.profiles p
  WHERE p.id <> v_uid
    AND p.username IS NOT NULL
    AND p.username ILIKE '%' || v_trim || '%'
  ORDER BY p.username ASC
  LIMIT v_lim;
END;
$$;

ALTER FUNCTION public.search_profiles_for_friend_invite(text, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.search_profiles_for_friend_invite(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles_for_friend_invite(text, integer) TO authenticated;

COMMIT;
