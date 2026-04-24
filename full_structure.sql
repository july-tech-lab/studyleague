


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."group_role" AS ENUM (
    'group_admin',
    'group_member'
);


ALTER TYPE "public"."group_role" OWNER TO "postgres";


CREATE TYPE "public"."group_visibility" AS ENUM (
    'public',
    'private'
);


ALTER TYPE "public"."group_visibility" OWNER TO "postgres";


CREATE TYPE "public"."membership_status" AS ENUM (
    'pending',
    'approved'
);


ALTER TYPE "public"."membership_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'planned',
    'in-progress',
    'done'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "user_id" "uuid",
    "role" "public"."group_role" DEFAULT 'group_member'::"public"."group_role",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."membership_status" DEFAULT 'approved'::"public"."membership_status"
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."group_members" IS 'Group membership with role (admin/member) and status (pending/approved).';



COMMENT ON COLUMN "public"."group_members"."status" IS 'Membership status: pending (awaiting approval) or approved (active member)';



CREATE OR REPLACE FUNCTION "public"."add_group_creator_as_admin"("p_group_id" "uuid", "p_user_id" "uuid") RETURNS "public"."group_members"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  result group_members%rowtype;
begin
  -- Security check: ensure the caller is the user they claim to be
  if p_user_id is distinct from auth.uid() then
    raise exception 'UNAUTHORIZED';
  end if;

  -- Verify the user is the creator of the group
  if not exists (
    select 1 from groups g
    where g.id = p_group_id
      and g.created_by = p_user_id
  ) then
    raise exception 'NOT_GROUP_CREATOR';
  end if;

  -- Check if already a member (idempotent)
  if exists (
    select 1 from group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
  ) then
    -- Return existing membership
    select * into result from group_members
    where group_id = p_group_id
      and user_id = p_user_id;
    return result;
  end if;

  -- Insert the creator as admin member
  insert into group_members (group_id, user_id, role, status)
  values (p_group_id, p_user_id, 'group_admin', 'approved')
  returning * into result;

  return result;
end;
$$;


ALTER FUNCTION "public"."add_group_creator_as_admin"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_streak_expiry_for_me"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  today_utc date := (timezone('utc', now()))::date;
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles p
  SET current_streak = 0
  WHERE p.id = uid
    AND p.current_streak > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_summaries ds
      WHERE ds.user_id = uid
        AND ds.date >= today_utc - 1
    );
END;
$$;


ALTER FUNCTION "public"."apply_streak_expiry_for_me"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_deleted_tasks"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
    -- Delete tasks that were soft-deleted more than 30 days ago
    DELETE FROM public.tasks
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - interval '30 days';
  END;
  $$;


ALTER FUNCTION "public"."cleanup_deleted_tasks"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_deleted_tasks"() IS 'Hard-deletes tasks that were soft-deleted more than 30 days ago. Run periodically via cron.';



CREATE OR REPLACE FUNCTION "public"."create_group_with_creator"("p_name" "text", "p_description" "text", "p_visibility" "public"."group_visibility", "p_requires_admin_approval" boolean, "p_join_password" "text") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "visibility" "public"."group_visibility", "invite_code" "text", "requires_admin_approval" boolean, "has_password" boolean, "created_by" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_group_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  -- Insert the group
  insert into groups (
    name,
    description,
    visibility,
    requires_admin_approval,
    join_password,
    created_by
  )
  values (
    p_name,
    nullif(trim(p_description), ''),
    p_visibility,
    p_requires_admin_approval,
    nullif(trim(p_join_password), ''),
    v_user_id
  )
  returning groups.id into v_group_id;

  -- Add creator as admin member (bypasses RLS in security definer function)
  insert into group_members (group_id, user_id, role, status)
  values (v_group_id, v_user_id, 'group_admin', 'approved');

  -- Return the created group
  return query
  select 
    g.id,
    g.name,
    g.description,
    g.visibility,
    g.invite_code,
    g.requires_admin_approval,
    g.has_password,
    g.created_by,
    g.created_at
  from groups g
  where g.id = v_group_id;
end;
$$;


ALTER FUNCTION "public"."create_group_with_creator"("p_name" "text", "p_description" "text", "p_visibility" "public"."group_visibility", "p_requires_admin_approval" boolean, "p_join_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_current_user"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
    -- Simply delete the user from auth.users. 
    -- Because you have ON DELETE CASCADE set up on profiles, tasks, etc.,
    -- Postgres will automatically and safely clean up all related data.
    DELETE FROM auth.users WHERE id = auth.uid();
  END;
  $$;


ALTER FUNCTION "public"."delete_current_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_group_by_invite_code"("p_code" "text") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "visibility" "public"."group_visibility", "created_by" "uuid", "created_at" timestamp with time zone, "requires_admin_approval" boolean, "invite_code" "text", "has_password" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select id, name, description, visibility, created_by, created_at, requires_admin_approval, invite_code, has_password
  from groups
  where lower(invite_code) = lower(p_code);
end;
$$;


ALTER FUNCTION "public"."find_group_by_invite_code"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_groups"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "visibility" "public"."group_visibility", "invite_code" "text", "requires_admin_approval" boolean, "has_password" boolean, "created_by" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.description,
    g.visibility,
    g.invite_code,
    g.requires_admin_approval,
    g.has_password,
    g.created_by,
    g.created_at
  FROM public.groups g
  INNER JOIN public.group_members gm ON gm.group_id = g.id
  WHERE gm.user_id = p_user_id
    AND gm.status = 'approved'
    AND (p_user_id = auth.uid() OR g.visibility = 'public');
END;
$$;


ALTER FUNCTION "public"."get_user_groups"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_session_completed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_session_completed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_task_completed_xp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_task_completed_xp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_leaderboards"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.weekly_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.monthly_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.yearly_leaderboard;
  END;
  $$;


ALTER FUNCTION "public"."refresh_leaderboards"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_leaderboards"() IS 'Refreshes all leaderboard materialized views. Call this periodically (e.g., via pg_cron every hour)';



CREATE OR REPLACE FUNCTION "public"."regenerate_invite_code"("p_group_id" "uuid") RETURNS TABLE("invite_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  new_code text;
begin
  new_code := lower(encode(gen_random_bytes(4), 'hex'));

  update groups
  set invite_code = new_code
  where id = p_group_id
    and exists (
      select 1 from group_members gm
      where gm.group_id = p_group_id
        and gm.user_id = auth.uid()
        and gm.role = 'group_admin'
    )
  returning invite_code;

  return query select new_code;
end;
$$;


ALTER FUNCTION "public"."regenerate_invite_code"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_join_group"("p_group_id" "uuid", "p_password" "text" DEFAULT NULL::"text") RETURNS "public"."group_members"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  g record;
  result group_members%rowtype;
begin
  select * into g from groups where id = p_group_id;
  if not found then
    raise exception 'GROUP_NOT_FOUND';
  end if;

  if g.visibility <> 'public' then
    raise exception 'GROUP_NOT_PUBLIC';
  end if;

  if g.join_password is not null and (p_password is null or p_password <> g.join_password) then
    raise exception 'INVALID_PASSWORD';
  end if;

  if exists (select 1 from group_members gm where gm.group_id = p_group_id and gm.user_id = auth.uid()) then
    raise exception 'ALREADY_MEMBER';
  end if;

  insert into group_members (group_id, user_id, role, status)
  values (
    p_group_id,
    auth.uid(),
    'group_member'::"public"."group_role",
    case
      when g.requires_admin_approval then 'pending'::"public"."membership_status"
      else 'approved'::"public"."membership_status"
    end
  )
  returning * into result;

  return result;
end;
$$;


ALTER FUNCTION "public"."request_join_group"("p_group_id" "uuid", "p_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
  begin
    new.updated_at = now();
    return new;
  end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_group_member_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
    -- Update count when membership changes
    IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
      UPDATE public.groups
      SET member_count = member_count + 1
      WHERE id = NEW.group_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
      UPDATE public.groups
      SET member_count = GREATEST(0, member_count - 1)
      WHERE id = OLD.group_id;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Status changed from pending to approved
      IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
        UPDATE public.groups
        SET member_count = member_count + 1
        WHERE id = NEW.group_id;
      -- Status changed from approved to pending
      ELSIF OLD.status = 'approved' AND NEW.status != 'approved' THEN
        UPDATE public.groups
        SET member_count = GREATEST(0, member_count - 1)
        WHERE id = NEW.group_id;
      END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
  END;
  $$;


ALTER FUNCTION "public"."update_group_member_count"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_summaries" (
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "total_seconds" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_summaries" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_summaries" IS 'Daily aggregated study time per user. Used for streaks and leaderboards.';



CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "visibility" "public"."group_visibility" DEFAULT 'private'::"public"."group_visibility",
    "requires_admin_approval" boolean DEFAULT false,
    "invite_code" "text" DEFAULT "lower"("encode"("extensions"."gen_random_bytes"(4), 'hex'::"text")) NOT NULL,
    "join_password" "text",
    "has_password" boolean GENERATED ALWAYS AS ((("join_password" IS NOT NULL) AND ("length"("join_password") > 0))) STORED,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "member_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "check_invite_code_format" CHECK (("char_length"("invite_code") >= 4))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."groups" IS 'Study groups with invite codes. Visibility: public (anyone can join) or private (invite only).';



COMMENT ON COLUMN "public"."groups"."invite_code" IS 'Unique 8-character hex code for joining the group';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "avatar_url" "text",
    "xp_total" bigint DEFAULT 0,
    "level" integer DEFAULT 1,
    "current_streak" integer DEFAULT 0,
    "longest_streak" integer DEFAULT 0,
    "weekly_goal_minutes" integer DEFAULT 1200,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_public" boolean DEFAULT false NOT NULL,
    "show_in_leaderboard" boolean DEFAULT true NOT NULL,
    "language_preference" "text",
    "theme_preference" "text",
    "onboarding_completed" boolean DEFAULT true NOT NULL,
    "academic_category" "text",
    "academic_year_key" "text",
    "specialty_keys" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "check_weekly_goal" CHECK ((("weekly_goal_minutes" >= 0) AND ("weekly_goal_minutes" <= 10080))),
    CONSTRAINT "language_preference_check" CHECK ((("language_preference" IS NULL) OR ("language_preference" = ANY (ARRAY['en'::"text", 'fr'::"text"])))),
    CONSTRAINT "theme_preference_check" CHECK ((("theme_preference" IS NULL) OR ("theme_preference" = ANY (ARRAY['light'::"text", 'dark'::"text"])))),
    CONSTRAINT "username_format" CHECK ((("username" IS NULL) OR ("username" ~* '^[a-zA-Z0-9_]+$'::"text"))),
    CONSTRAINT "username_len" CHECK (("char_length"("username") >= 3))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'User profiles with XP, level, streaks, and goals. Linked to auth.users via id.';



COMMENT ON COLUMN "public"."profiles"."xp_total" IS 'Total experience points earned (1 second of study = 1 XP)';



COMMENT ON COLUMN "public"."profiles"."level" IS 'User level calculated as: 1 + floor(xp_total / 3600)';



COMMENT ON COLUMN "public"."profiles"."current_streak" IS 'Current consecutive days with study activity';



COMMENT ON COLUMN "public"."profiles"."is_public" IS 'Whether this profile is visible to other users. Default false (private).';



COMMENT ON COLUMN "public"."profiles"."show_in_leaderboard" IS 'Whether this user appears in leaderboards. Default true (opt-out).';



COMMENT ON COLUMN "public"."profiles"."language_preference" IS 'User preferred language: "en" for English, "fr" for French. NULL means use system default.';



COMMENT ON COLUMN "public"."profiles"."theme_preference" IS 'User preferred theme: "light" or "dark". NULL means use system default.';



COMMENT ON COLUMN "public"."profiles"."onboarding_completed" IS 'False until user finishes in-app onboarding (fill-profile).';



COMMENT ON COLUMN "public"."profiles"."academic_category" IS 'App category id: primaire, college, lycee, prepa, universite, autres.';



COMMENT ON COLUMN "public"."profiles"."academic_year_key" IS 'e.g. lycee_premiere, college_3e.';



COMMENT ON COLUMN "public"."profiles"."specialty_keys" IS 'Lycée spécialités keys from app catalog (e.g. spe_mathematics).';



CREATE MATERIALIZED VIEW "public"."monthly_leaderboard" AS
 SELECT "p"."id" AS "user_id",
    "p"."username",
    "p"."avatar_url",
    "p"."level",
    COALESCE("sum"("ds"."total_seconds"), (0)::bigint) AS "total_seconds"
   FROM ("public"."profiles" "p"
     LEFT JOIN "public"."daily_summaries" "ds" ON ((("ds"."user_id" = "p"."id") AND ("ds"."date" >= (CURRENT_DATE - 30)))))
  WHERE ("p"."show_in_leaderboard" = true)
  GROUP BY "p"."id", "p"."username", "p"."avatar_url", "p"."level"
  ORDER BY COALESCE("sum"("ds"."total_seconds"), (0)::bigint) DESC
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."monthly_leaderboard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject_id" "uuid",
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone NOT NULL,
    "duration_seconds" integer GENERATED ALWAYS AS (EXTRACT(epoch FROM ("ended_at" - "started_at"))) STORED,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "task_id" "uuid",
    CONSTRAINT "check_duration_reasonable" CHECK ((("duration_seconds" > 0) AND ("duration_seconds" <= 86400))),
    CONSTRAINT "check_no_future_sessions" CHECK (("ended_at" <= ("now"() + '00:01:00'::interval))),
    CONSTRAINT "check_session_duration" CHECK (("ended_at" > "started_at"))
);


ALTER TABLE "public"."study_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."study_sessions" IS 'Individual study sessions with start/end times. Duration is auto-calculated.';



COMMENT ON COLUMN "public"."study_sessions"."duration_seconds" IS 'Auto-calculated duration in seconds (generated column)';



CREATE OR REPLACE VIEW "public"."session_overview" WITH ("security_invoker"='on') AS
 SELECT "user_id",
    "count"(*) AS "session_count",
    COALESCE("sum"("duration_seconds"), (0)::bigint) AS "total_seconds",
    COALESCE("sum"("duration_seconds") FILTER (WHERE ("started_at" >= "date_trunc"('month'::"text", "now"()))), (0)::bigint) AS "month_seconds",
    COALESCE("avg"("duration_seconds"), (0)::numeric) AS "avg_seconds"
   FROM "public"."study_sessions" "ss"
  GROUP BY "user_id";


ALTER VIEW "public"."session_overview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "icon" "text",
    "color" "text",
    "owner_id" "uuid",
    "parent_subject_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "bank_key" "text",
    CONSTRAINT "check_hex_color" CHECK ((("color" IS NULL) OR ("color" ~* '^#[a-f0-9]{6}$'::"text")))
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


COMMENT ON TABLE "public"."subjects" IS 'Subject catalog. owner_id = NULL means global subject, otherwise user-specific.';



COMMENT ON COLUMN "public"."subjects"."color" IS 'Hex color code in format #RRGGBB (e.g., #FF5733)';



COMMENT ON COLUMN "public"."subjects"."deleted_at" IS 'Soft delete timestamp. NULL means subject is active. Set to timestamp when subject is deleted.';



CREATE OR REPLACE VIEW "public"."session_subject_totals" WITH ("security_invoker"='on') AS
 WITH "base" AS (
         SELECT "ss"."user_id",
            "ss"."duration_seconds",
            "ss"."started_at",
            "s"."id" AS "subject_id",
            "s"."name" AS "subject_name",
            true AS "is_root"
           FROM ("public"."study_sessions" "ss"
             JOIN "public"."subjects" "s" ON ((("s"."id" = "ss"."subject_id") AND ("s"."deleted_at" IS NULL))))
        )
 SELECT "user_id",
    "subject_id",
    "subject_name",
    COALESCE("sum"("duration_seconds"), (0)::bigint) AS "total_seconds",
    COALESCE("sum"("duration_seconds") FILTER (WHERE "is_root"), (0)::bigint) AS "direct_seconds",
    COALESCE("sum"("duration_seconds") FILTER (WHERE (NOT "is_root")), (0)::bigint) AS "subtag_seconds"
   FROM "base"
  GROUP BY "user_id", "subject_id", "subject_name";


ALTER VIEW "public"."session_subject_totals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subject_weekly_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "minutes" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subject_weekly_goals_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "subject_weekly_goals_minutes_check" CHECK ((("minutes" >= 0) AND ("minutes" <= 480)))
);


ALTER TABLE "public"."subject_weekly_goals" OWNER TO "postgres";


COMMENT ON TABLE "public"."subject_weekly_goals" IS 'Per-day study time goals per subject (0=Sun, 1=Mon, ..., 6=Sat)';



COMMENT ON COLUMN "public"."subject_weekly_goals"."day_of_week" IS '0=Sunday, 1=Monday, ..., 6=Saturday';



COMMENT ON COLUMN "public"."subject_weekly_goals"."minutes" IS 'Goal minutes for this subject on this day (0-480)';



CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "user_id" "uuid" NOT NULL,
    "status" "public"."subscription_status" NOT NULL,
    "plan_id" "text",
    "price_id" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "status_changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject_id" "uuid",
    "title" "text" NOT NULL,
    "planned_minutes" integer,
    "scheduled_for" "date",
    "logged_seconds" integer DEFAULT 0 NOT NULL,
    "status" "public"."task_status" DEFAULT 'planned'::"public"."task_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "tasks_logged_seconds_check" CHECK (("logged_seconds" >= 0)),
    CONSTRAINT "tasks_planned_minutes_check" CHECK (("planned_minutes" >= 0))
);

ALTER TABLE ONLY "public"."tasks" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'User tasks with planned time and logged time tracking. Status: planned, in-progress, done.';



COMMENT ON COLUMN "public"."tasks"."logged_seconds" IS 'Total seconds logged across all linked study sessions (auto-updated by trigger). Can exceed planned_minutes if user over-delivers.';



CREATE TABLE IF NOT EXISTS "public"."user_subjects" (
    "user_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_order" integer,
    "custom_color" "text",
    CONSTRAINT "check_custom_color_format" CHECK ((("custom_color" IS NULL) OR ("custom_color" ~* '^#[a-f0-9]{6}$'::"text")))
);


ALTER TABLE "public"."user_subjects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_subjects"."display_order" IS 'User-defined display order for subjects. Lower numbers appear first. NULL means use default (alphabetical).';



COMMENT ON COLUMN "public"."user_subjects"."custom_color" IS 'User-defined hex color for this subject (e.g., #FF5733). NULL means use default palette color.';



CREATE MATERIALIZED VIEW "public"."weekly_leaderboard" AS
 SELECT "p"."id" AS "user_id",
    "p"."username",
    "p"."avatar_url",
    "p"."level",
    COALESCE("sum"("s"."duration_seconds"), (0)::bigint) AS "weekly_seconds"
   FROM ("public"."profiles" "p"
     LEFT JOIN "public"."study_sessions" "s" ON ((("p"."id" = "s"."user_id") AND (("s"."ended_at")::"date" >= (CURRENT_DATE - 7)))))
  WHERE ("p"."show_in_leaderboard" = true)
  GROUP BY "p"."id", "p"."username", "p"."avatar_url", "p"."level"
  ORDER BY COALESCE("sum"("s"."duration_seconds"), (0)::bigint) DESC
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."weekly_leaderboard" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."yearly_leaderboard" AS
 SELECT "p"."id" AS "user_id",
    "p"."username",
    "p"."avatar_url",
    "p"."level",
    COALESCE("sum"("ds"."total_seconds"), (0)::bigint) AS "total_seconds"
   FROM ("public"."profiles" "p"
     LEFT JOIN "public"."daily_summaries" "ds" ON ((("ds"."user_id" = "p"."id") AND ("ds"."date" >= (CURRENT_DATE - 365)))))
  WHERE ("p"."show_in_leaderboard" = true)
  GROUP BY "p"."id", "p"."username", "p"."avatar_url", "p"."level"
  ORDER BY COALESCE("sum"("ds"."total_seconds"), (0)::bigint) DESC
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."yearly_leaderboard" OWNER TO "postgres";


ALTER TABLE ONLY "public"."daily_summaries"
    ADD CONSTRAINT "daily_summaries_pkey" PRIMARY KEY ("user_id", "date");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_unique" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subject_weekly_goals"
    ADD CONSTRAINT "subject_weekly_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subject_weekly_goals"
    ADD CONSTRAINT "subject_weekly_goals_user_id_subject_id_day_of_week_key" UNIQUE ("user_id", "subject_id", "day_of_week");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subjects"
    ADD CONSTRAINT "user_subjects_pkey" PRIMARY KEY ("user_id", "subject_id");



CREATE INDEX "daily_summaries_covering_idx" ON "public"."daily_summaries" USING "btree" ("date", "user_id") INCLUDE ("total_seconds");



CREATE INDEX "daily_summaries_user_id_date_idx" ON "public"."daily_summaries" USING "btree" ("user_id", "date");



CREATE INDEX "idx_group_members_group" ON "public"."group_members" USING "btree" ("group_id");



CREATE INDEX "idx_group_members_group_status_approved" ON "public"."group_members" USING "btree" ("group_id", "user_id", "status") WHERE ("status" = 'approved'::"public"."membership_status");



CREATE INDEX "idx_group_members_status" ON "public"."group_members" USING "btree" ("group_id", "status") WHERE ("status" = 'pending'::"public"."membership_status");



CREATE INDEX "idx_group_members_user" ON "public"."group_members" USING "btree" ("user_id");



CREATE INDEX "idx_groups_created_by" ON "public"."groups" USING "btree" ("created_by");



CREATE UNIQUE INDEX "idx_groups_invite_code" ON "public"."groups" USING "btree" ("invite_code");



CREATE INDEX "idx_groups_member_count" ON "public"."groups" USING "btree" ("member_count" DESC, "created_at" DESC);



CREATE UNIQUE INDEX "idx_profiles_username_unique" ON "public"."profiles" USING "btree" ("lower"("username")) WHERE ("username" IS NOT NULL);



CREATE INDEX "idx_study_sessions_date_range" ON "public"."study_sessions" USING "btree" ("ended_at" DESC, "user_id") WHERE ("ended_at" IS NOT NULL);



CREATE INDEX "idx_study_sessions_started_at" ON "public"."study_sessions" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_study_sessions_task" ON "public"."study_sessions" USING "btree" ("task_id");



CREATE INDEX "idx_study_sessions_user_date" ON "public"."study_sessions" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "idx_subject_weekly_goals_subject" ON "public"."subject_weekly_goals" USING "btree" ("subject_id");



CREATE INDEX "idx_subject_weekly_goals_user" ON "public"."subject_weekly_goals" USING "btree" ("user_id");



CREATE INDEX "idx_subjects_deleted_at" ON "public"."subjects" USING "btree" ("owner_id", "deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_subjects_global_deleted_at" ON "public"."subjects" USING "btree" ("deleted_at") WHERE (("owner_id" IS NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "idx_subjects_owner_active" ON "public"."subjects" USING "btree" ("owner_id", "is_active") WHERE ("owner_id" IS NOT NULL);



CREATE INDEX "idx_tasks_active" ON "public"."tasks" USING "btree" ("user_id", "scheduled_for") WHERE (("status" = ANY (ARRAY['planned'::"public"."task_status", 'in-progress'::"public"."task_status"])) AND ("scheduled_for" IS NOT NULL));



CREATE INDEX "idx_tasks_completed" ON "public"."tasks" USING "btree" ("user_id", "updated_at" DESC) WHERE ("status" = 'done'::"public"."task_status");



CREATE INDEX "idx_tasks_deleted_at" ON "public"."tasks" USING "btree" ("user_id", "deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_tasks_status_filter" ON "public"."tasks" USING "btree" ("user_id", "status");



CREATE INDEX "idx_tasks_subject" ON "public"."tasks" USING "btree" ("subject_id");



CREATE INDEX "idx_tasks_user" ON "public"."tasks" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_user_status_date" ON "public"."tasks" USING "btree" ("user_id", "status", "scheduled_for") WHERE ("scheduled_for" IS NOT NULL);



CREATE UNIQUE INDEX "monthly_leaderboard_user_id_idx" ON "public"."monthly_leaderboard" USING "btree" ("user_id");



CREATE INDEX "profiles_level_idx" ON "public"."profiles" USING "btree" ("level");



CREATE INDEX "study_sessions_ended_at_idx" ON "public"."study_sessions" USING "btree" ("ended_at");



CREATE INDEX "study_sessions_subject_id_idx" ON "public"."study_sessions" USING "btree" ("subject_id");



CREATE INDEX "subjects_owner_id_idx" ON "public"."subjects" USING "btree" ("owner_id");



CREATE UNIQUE INDEX "subjects_owner_name_unique" ON "public"."subjects" USING "btree" ("owner_id", "lower"("name")) WHERE ("name" IS NOT NULL);



CREATE INDEX "subjects_parent_subject_id_idx" ON "public"."subjects" USING "btree" ("parent_subject_id");



CREATE INDEX "user_subjects_display_order_idx" ON "public"."user_subjects" USING "btree" ("user_id", "display_order");



CREATE INDEX "user_subjects_subject_idx" ON "public"."user_subjects" USING "btree" ("subject_id");



CREATE INDEX "user_subjects_user_idx" ON "public"."user_subjects" USING "btree" ("user_id");



CREATE UNIQUE INDEX "weekly_leaderboard_user_id_idx" ON "public"."weekly_leaderboard" USING "btree" ("user_id");



CREATE UNIQUE INDEX "yearly_leaderboard_user_id_idx" ON "public"."yearly_leaderboard" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "on_session_completed" AFTER INSERT ON "public"."study_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_session_completed"();



CREATE OR REPLACE TRIGGER "on_task_completed_xp" AFTER UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."handle_task_completed_xp"();



CREATE OR REPLACE TRIGGER "trg_subject_weekly_goals_updated" BEFORE UPDATE ON "public"."subject_weekly_goals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tasks_updated" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_update_group_member_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_group_member_count"();



CREATE OR REPLACE TRIGGER "update_groups_timestamp" BEFORE UPDATE ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_timestamp" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_subjects_timestamp" BEFORE UPDATE ON "public"."subjects" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."daily_summaries"
    ADD CONSTRAINT "daily_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id");



ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subject_weekly_goals"
    ADD CONSTRAINT "subject_weekly_goals_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subject_weekly_goals"
    ADD CONSTRAINT "subject_weekly_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_parent_subject_id_fkey" FOREIGN KEY ("parent_subject_id") REFERENCES "public"."subjects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subjects"
    ADD CONSTRAINT "user_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subjects"
    ADD CONSTRAINT "user_subjects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can update groups" ON "public"."groups" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "groups"."id") AND ("gm"."user_id" = "auth"."uid"()) AND ("gm"."role" = 'group_admin'::"public"."group_role") AND ("gm"."status" = 'approved'::"public"."membership_status"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "groups"."id") AND ("gm"."user_id" = "auth"."uid"()) AND ("gm"."role" = 'group_admin'::"public"."group_role") AND ("gm"."status" = 'approved'::"public"."membership_status")))));



CREATE POLICY "Group admins can update memberships" ON "public"."group_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_members"."group_id") AND ("gm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("gm"."role" = 'group_admin'::"public"."group_role") AND ("gm"."status" = 'approved'::"public"."membership_status"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_members"."group_id") AND ("gm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("gm"."role" = 'group_admin'::"public"."group_role") AND ("gm"."status" = 'approved'::"public"."membership_status")))));



CREATE POLICY "Group creators and admins can delete groups" ON "public"."groups" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "groups"."id") AND ("gm"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("gm"."role" = 'group_admin'::"public"."group_role") AND ("gm"."status" = 'approved'::"public"."membership_status"))))));



CREATE POLICY "Group members delete self" ON "public"."group_members" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Group members insert self" ON "public"."group_members" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Read all subjects" ON "public"."subjects" FOR SELECT USING (true);



CREATE POLICY "Subjects: owners can delete" ON "public"."subjects" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));



CREATE POLICY "Subjects: owners can update" ON "public"."subjects" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "owner_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "owner_id"));



CREATE POLICY "Update own profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "User can read their own subscription" ON "public"."subscriptions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "User creates personal subjects" ON "public"."subjects" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "User inserts own sessions" ON "public"."study_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create groups" ON "public"."groups" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can delete own sessions" ON "public"."study_sessions" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own tasks" ON "public"."tasks" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own weekly goals" ON "public"."subject_weekly_goals" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own tasks" ON "public"."tasks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own weekly goals" ON "public"."subject_weekly_goals" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read groups they belong to or public" ON "public"."groups" FOR SELECT USING ((("visibility" = 'public'::"public"."group_visibility") OR ("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "groups"."id") AND ("gm"."user_id" = "auth"."uid"()) AND ("gm"."status" = 'approved'::"public"."membership_status"))))));



CREATE POLICY "Users can read own daily summaries" ON "public"."daily_summaries" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own sessions" ON "public"."study_sessions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own sessions" ON "public"."study_sessions" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own tasks" ON "public"."tasks" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own weekly goals" ON "public"."subject_weekly_goals" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view active tasks" ON "public"."tasks" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view own profile or public profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") OR ("is_public" = true)));



CREATE POLICY "Users can view own weekly goals" ON "public"."subject_weekly_goals" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users cannot insert own subscription directly" ON "public"."subscriptions" FOR INSERT WITH CHECK (false);



CREATE POLICY "Users cannot update own subscription directly" ON "public"."subscriptions" FOR UPDATE TO "authenticated" USING (false);



CREATE POLICY "View members of visible groups" ON "public"."group_members" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."visibility" = 'public'::"public"."group_visibility")))) OR (EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."created_by" = "auth"."uid"()))))));



ALTER TABLE "public"."daily_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subject_weekly_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subjects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_subjects_delete_own" ON "public"."user_subjects" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_subjects_insert_own" ON "public"."user_subjects" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_subjects_select_own" ON "public"."user_subjects" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_subjects_update_own" ON "public"."user_subjects" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT ALL ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_group_creator_as_admin"("p_group_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_group_creator_as_admin"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_group_creator_as_admin"("p_group_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_streak_expiry_for_me"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_streak_expiry_for_me"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_streak_expiry_for_me"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_streak_expiry_for_me"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_deleted_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_deleted_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_deleted_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_group_with_creator"("p_name" "text", "p_description" "text", "p_visibility" "public"."group_visibility", "p_requires_admin_approval" boolean, "p_join_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_group_with_creator"("p_name" "text", "p_description" "text", "p_visibility" "public"."group_visibility", "p_requires_admin_approval" boolean, "p_join_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_group_with_creator"("p_name" "text", "p_description" "text", "p_visibility" "public"."group_visibility", "p_requires_admin_approval" boolean, "p_join_password" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_current_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_current_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_current_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_current_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_group_by_invite_code"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_group_by_invite_code"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_group_by_invite_code"("p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_groups"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_groups"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_groups"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_session_completed"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_session_completed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_session_completed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_task_completed_xp"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_task_completed_xp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_task_completed_xp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_leaderboards"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_leaderboards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_leaderboards"() TO "service_role";



GRANT ALL ON FUNCTION "public"."regenerate_invite_code"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."regenerate_invite_code"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regenerate_invite_code"("p_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_join_group"("p_group_id" "uuid", "p_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_join_group"("p_group_id" "uuid", "p_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_join_group"("p_group_id" "uuid", "p_password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_group_member_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_group_member_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_group_member_count"() TO "service_role";


















GRANT ALL ON TABLE "public"."daily_summaries" TO "anon";
GRANT ALL ON TABLE "public"."daily_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_leaderboard" TO "service_role";



GRANT ALL ON TABLE "public"."study_sessions" TO "anon";
GRANT ALL ON TABLE "public"."study_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."study_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."session_overview" TO "anon";
GRANT ALL ON TABLE "public"."session_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."session_overview" TO "service_role";



GRANT ALL ON TABLE "public"."subjects" TO "anon";
GRANT ALL ON TABLE "public"."subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."subjects" TO "service_role";



GRANT ALL ON TABLE "public"."session_subject_totals" TO "anon";
GRANT ALL ON TABLE "public"."session_subject_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."session_subject_totals" TO "service_role";



GRANT ALL ON TABLE "public"."subject_weekly_goals" TO "anon";
GRANT ALL ON TABLE "public"."subject_weekly_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."subject_weekly_goals" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_subjects" TO "anon";
GRANT ALL ON TABLE "public"."user_subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subjects" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_leaderboard" TO "service_role";



GRANT ALL ON TABLE "public"."yearly_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."yearly_leaderboard" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































