-- Backend Part 8 (Friends) hotfix: list_friends()/search_nexali_users() both
-- fail at runtime with:
--   ERROR: 42804: structure of query does not match function result type
--   DETAIL: Returned type character varying(255) does not match expected
--            type text in column 4.
--
-- Root cause: auth.users.email is declared `character varying(255)` (confirmed
-- live via information_schema.columns), but both functions' RETURNS TABLE
-- declares that column as `text`. PL/pgSQL's RETURN QUERY type-checks the
-- query's output tuple descriptor against the declared return type up
-- front, before any row is produced -- so this fires even when the query
-- would return zero rows (confirmed: both RPCs were reproduced failing
-- against a user with zero friendships/zero matches). This is NOT a
-- permissions, RLS, search_path, grant, or frontend-mapping problem --
-- every one of those was independently verified working. Every other
-- column (user_id uuid, full_name/avatar_url text, friendship_id uuid,
-- friends_since timestamptz, relationship_status text) already matched
-- exactly and needs no change.
--
-- This is a NEW forward-only migration -- 20260919000200_friends_rpcs.sql
-- (already deployed) is left untouched. Both functions are reproduced here
-- byte-for-byte from their live pg_get_functiondef() output, with the
-- single addition of an explicit `::text` cast on the two `u.email`
-- references that feed the declared `email text` output column. No other
-- behavior, validation, security, or grant changes.

CREATE OR REPLACE FUNCTION "public"."list_friends"()
RETURNS TABLE("user_id" "uuid", "full_name" "text", "avatar_url" "text", "email" "text", "friendship_id" "uuid", "friends_since" timestamp with time zone)
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'list_friends requires an authenticated user';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    u.email::text,
    f.id,
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p ON p.id = (CASE WHEN f.user_one_id = v_uid THEN f.user_two_id ELSE f.user_one_id END)
  JOIN auth.users u ON u.id = p.id
  WHERE f.user_one_id = v_uid OR f.user_two_id = v_uid
  ORDER BY p.full_name ASC NULLS LAST, p.id ASC;
END;
$$;

ALTER FUNCTION "public"."list_friends"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."list_friends"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."list_friends"() TO "authenticated";

CREATE OR REPLACE FUNCTION "public"."search_nexali_users"("p_query" "text")
RETURNS TABLE("user_id" "uuid", "full_name" "text", "avatar_url" "text", "email" "text", "relationship_status" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_query text := lower(trim(p_query));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'search_nexali_users requires an authenticated user';
  END IF;

  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    CASE WHEN lower(trim(u.email)) = v_query THEN u.email::text ELSE NULL END,
    CASE
      WHEN f.id IS NOT NULL THEN 'friends'
      WHEN pr_out.id IS NOT NULL THEN 'outgoing_pending'
      WHEN pr_in.id IS NOT NULL THEN 'incoming_pending'
      ELSE 'none'
    END
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.friendships f
    ON f.user_one_id = LEAST(v_uid, p.id) AND f.user_two_id = GREATEST(v_uid, p.id)
  LEFT JOIN public.friend_requests pr_out
    ON pr_out.sender_id = v_uid AND pr_out.recipient_id = p.id AND pr_out.status = 'pending'
  LEFT JOIN public.friend_requests pr_in
    ON pr_in.sender_id = p.id AND pr_in.recipient_id = v_uid AND pr_in.status = 'pending'
  WHERE p.id <> v_uid
    AND (
      strpos(lower(coalesce(p.full_name, '')), v_query) > 0
      OR lower(trim(u.email)) = v_query
    )
  ORDER BY p.full_name ASC NULLS LAST, p.id ASC
  LIMIT 20;
END;
$$;

ALTER FUNCTION "public"."search_nexali_users"("p_query" "text") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."search_nexali_users"("p_query" "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."search_nexali_users"("p_query" "text") TO "authenticated";
