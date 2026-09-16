-- Backend Part 8 (Friends): all Friends RPCs.
--
-- Every function below follows the exact hardened pattern already
-- established in this codebase (delete_user_everything's service-role
-- guard, update_user_settings's auth.uid()-only identity, the Backend
-- Part 4/5 aggregate functions' auth.uid()-derived-never-parameter
-- discipline):
--   * identity is derived ONLY from auth.uid() -- no function below
--     accepts a parameter representing the calling user;
--   * auth.uid() IS NULL is rejected with a real exception, never a
--     silent no-op that could be mistaken for success;
--   * `SET search_path TO 'public', 'pg_temp'` pins the search path;
--   * every table reference is schema-qualified (public./auth.);
--   * `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated`
--     only -- no anon grant on any of these, cross-user operations must be
--     authenticated.
--
-- search_nexali_users/list_friends/list_incoming_friend_requests are
-- SECURITY DEFINER because they legitimately need to read OTHER users'
-- public.profiles rows and (for exact-email search / accepted friends
-- only) auth.users.email -- both of which the recipient's/searcher's own
-- RLS would otherwise correctly block (profiles' SELECT policy is
-- `auth.uid() = id` ONLY, confirmed live). SECURITY DEFINER here is the
-- intentional, narrowly-scoped exception the task asked for -- each
-- function returns ONLY the specific columns the frontend needs, never a
-- raw table row, and never anything from auth.users beyond `email` itself
-- (no password hash, phone, provider metadata, last-sign-in, or any other
-- auth field).

-- ============================================================================
-- search_nexali_users(p_query): bounded, privacy-safe user search.
--
-- SEARCH PRIVACY (the task's central requirement) -- proven, not merely
-- asserted: `email` is computed via a CASE expression that evaluates to
-- SQL NULL for every row that isn't an exact (trimmed, case-insensitive)
-- match for `p_query`. A NULL here is never a value the client merely
-- chooses to hide -- it is genuinely absent from the query result set
-- PostgREST serializes, so there is nothing for a browser to "unhide" by
-- inspecting the network response.
--
-- Name matching uses `strpos()` (a literal substring search), never
-- `ILIKE`/`LIKE` with the raw query interpolated into a pattern -- this is
-- what makes wildcard characters (%, _) in `p_query` inert: strpos() has
-- no pattern-matching semantics at all, so a query of "%" only ever
-- matches a full_name that literally contains the character "%", never
-- "everyone". Combined with the LIMIT and the 2-character minimum, this
-- makes a full-directory dump structurally impossible through this
-- function.
-- ============================================================================
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

  -- Below the minimum meaningful length, return zero rows rather than
  -- raising -- a still-typing user's 1-character query is not an error.
  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    CASE WHEN lower(trim(u.email)) = v_query THEN u.email ELSE NULL END,
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
  WHERE p.id <> v_uid -- self-exclusion: derived from auth.uid(), never a client-supplied id to omit
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

-- ============================================================================
-- list_friends(): accepted friends only, email included (allowed here --
-- the relationship is mutually accepted). Ordered by full name ascending
-- for a stable, predictable list (matches the Friends page's existing
-- alphabetical-feeling mock order; documented as a deliberate choice, not
-- an accident -- see docs/BACKEND_AUDIT_REPORT.md's Friends entry).
-- ============================================================================
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
    u.email,
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

-- ============================================================================
-- list_incoming_friend_requests(): pending requests where the caller is
-- recipient. Deliberately NEVER selects the sender's email, anywhere in
-- this function -- matching the "incoming request shows full name + avatar
-- only" frontend rule at the server, not just in React.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."list_incoming_friend_requests"()
RETURNS TABLE("request_id" "uuid", "sender_user_id" "uuid", "sender_full_name" "text", "sender_avatar_url" "text", "created_at" timestamp with time zone)
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'list_incoming_friend_requests requires an authenticated user';
  END IF;

  RETURN QUERY
  SELECT fr.id, p.id, p.full_name, p.avatar_url, fr.created_at
  FROM public.friend_requests fr
  JOIN public.profiles p ON p.id = fr.sender_id
  WHERE fr.recipient_id = v_uid AND fr.status = 'pending'
  ORDER BY fr.created_at DESC;
END;
$$;

ALTER FUNCTION "public"."list_incoming_friend_requests"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."list_incoming_friend_requests"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."list_incoming_friend_requests"() TO "authenticated";

-- ============================================================================
-- get_incoming_friend_request_count(): a real count, not a fetch-all-then-
-- count -- backed by friend_requests_pending_recipient_idx. This is the
-- Friends badge's real data source (replacing the prior frontend-only
-- mock count), independent of the Notifications unread count.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."get_incoming_friend_request_count"()
RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'get_incoming_friend_request_count requires an authenticated user';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.friend_requests
  WHERE recipient_id = v_uid AND status = 'pending';

  RETURN v_count;
END;
$$;

ALTER FUNCTION "public"."get_incoming_friend_request_count"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_incoming_friend_request_count"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_incoming_friend_request_count"() TO "authenticated";

-- ============================================================================
-- send_friend_request(p_recipient_id): atomically creates the request AND
-- the recipient's real Notifications-backend notification -- both
-- statements run inside this one function call's implicit transaction
-- (the established Nexali pattern from update_user_settings/
-- evaluate_budget_notifications), so a failure on either side leaves
-- NEITHER committed.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."send_friend_request"("p_recipient_id" "uuid")
RETURNS "uuid"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_sender_name text;
  v_existing record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'send_friend_request requires an authenticated user';
  END IF;
  IF p_recipient_id IS NULL THEN
    RAISE EXCEPTION 'send_friend_request: a recipient is required';
  END IF;
  IF p_recipient_id = v_uid THEN
    RAISE EXCEPTION 'You cannot send a friend request to yourself';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RAISE EXCEPTION 'That Nexali user could not be found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_one_id = LEAST(v_uid, p_recipient_id) AND user_two_id = GREATEST(v_uid, p_recipient_id)
  ) THEN
    RAISE EXCEPTION 'You are already friends with this user';
  END IF;

  -- Explicit pre-check for a specific, friendly error -- the partial
  -- unique index (friend_requests_pending_pair_uidx) is the real,
  -- race-condition-proof backstop (see the EXCEPTION handler below), this
  -- check just makes the ordinary, non-racing case's error message exact.
  SELECT * INTO v_existing FROM public.friend_requests
  WHERE status = 'pending'
    AND ((sender_id = v_uid AND recipient_id = p_recipient_id) OR (sender_id = p_recipient_id AND recipient_id = v_uid))
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.sender_id = v_uid THEN
      RAISE EXCEPTION 'A friend request is already pending';
    ELSE
      -- Reverse-pending case: B already asked A. Do NOT create a second
      -- request and do NOT auto-accept -- the caller must Accept/Decline
      -- the real incoming request explicitly.
      RAISE EXCEPTION 'This user already sent you a friend request -- check your incoming requests';
    END IF;
  END IF;

  INSERT INTO public.friend_requests (sender_id, recipient_id)
  VALUES (v_uid, p_recipient_id)
  RETURNING id INTO v_request_id;

  SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.notifications (user_id, type, title, description, action_href, action_label, dedupe_key, friend_request_id)
  VALUES (
    p_recipient_id,
    'friend_request',
    'Friend Request',
    coalesce(v_sender_name, 'Someone') || ' sent you a friend request.',
    '/friends',
    'View',
    -- The real duplicate-prevention backstop is friend_requests_pending_pair_uidx
    -- above, not this dedupe_key -- v_request_id is freshly generated per
    -- call, so this key can never collide across two DIFFERENT requests.
    -- It exists to match the established per-producer dedupe_key
    -- convention (Backend Part 7's budget producer) rather than to do any
    -- independent enforcement here.
    'friend-request:' || v_request_id::text,
    v_request_id
  );

  RETURN v_request_id;
EXCEPTION
  WHEN unique_violation THEN
    -- Race-condition backstop: two concurrent sends for the same pair (or
    -- a double-click that raced past the pre-check above) hit
    -- friend_requests_pending_pair_uidx here instead of silently creating
    -- a duplicate pending request.
    RAISE EXCEPTION 'A friend request is already pending between you and this user';
END;
$$;

ALTER FUNCTION "public"."send_friend_request"("p_recipient_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."send_friend_request"("p_recipient_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."send_friend_request"("p_recipient_id" "uuid") TO "authenticated";

-- ============================================================================
-- accept_friend_request(p_request_id): atomic accept -- validates, flips
-- the request to accepted, creates the canonical friendship, and resolves
-- (reads + dismisses) the recipient's own associated notification, all in
-- one transaction. `SELECT ... FOR UPDATE` locks the target row so a
-- concurrent Accept/Decline on the same request (two tabs, a double-click,
-- a network retry) serializes instead of racing -- the second call sees
-- the already-updated status and returns the safe, idempotent outcome
-- below rather than corrupting state.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."accept_friend_request"("p_request_id" "uuid")
RETURNS "void"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'accept_friend_request requires an authenticated user';
  END IF;

  SELECT * INTO v_req FROM public.friend_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
  -- Only the recipient may accept -- neither the sender nor an unrelated
  -- third party (auth.uid() derived, never trusted from the browser).
  IF v_req.recipient_id <> v_uid THEN
    RAISE EXCEPTION 'Only the recipient can accept this request';
  END IF;

  IF v_req.status = 'accepted' THEN
    -- Idempotent: already accepted (double-click/retry/two tabs) -- a
    -- safe no-op, not an error, and never a duplicate friendship.
    RETURN;
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'This friend request is no longer pending';
  END IF;

  UPDATE public.friend_requests
  SET status = 'accepted', responded_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.friendships (user_one_id, user_two_id)
  VALUES (LEAST(v_req.sender_id, v_req.recipient_id), GREATEST(v_req.sender_id, v_req.recipient_id))
  ON CONFLICT (user_one_id, user_two_id) DO NOTHING;

  -- Resolve the recipient's own notification for this request -- read AND
  -- dismissed, so the unread count is correct and the user can't
  -- re-trigger Accept/Decline from a stale Notifications view. Scoped to
  -- user_id = v_uid (the recipient's own row) as an extra guard, though
  -- friend_request_id already uniquely identifies at most one such row.
  UPDATE public.notifications
  SET read_at = coalesce(read_at, now()), dismissed_at = coalesce(dismissed_at, now())
  WHERE friend_request_id = p_request_id AND user_id = v_uid;
END;
$$;

ALTER FUNCTION "public"."accept_friend_request"("p_request_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."accept_friend_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."accept_friend_request"("p_request_id" "uuid") TO "authenticated";

-- ============================================================================
-- decline_friend_request(p_request_id): mirrors accept_friend_request()
-- exactly, minus the friendship creation. Never creates a friendship.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."decline_friend_request"("p_request_id" "uuid")
RETURNS "void"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'decline_friend_request requires an authenticated user';
  END IF;

  SELECT * INTO v_req FROM public.friend_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
  IF v_req.recipient_id <> v_uid THEN
    RAISE EXCEPTION 'Only the recipient can decline this request';
  END IF;

  IF v_req.status = 'declined' THEN
    RETURN; -- idempotent, same reasoning as accept_friend_request()
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'This friend request is no longer pending';
  END IF;

  UPDATE public.friend_requests
  SET status = 'declined', responded_at = now()
  WHERE id = p_request_id;

  UPDATE public.notifications
  SET read_at = coalesce(read_at, now()), dismissed_at = coalesce(dismissed_at, now())
  WHERE friend_request_id = p_request_id AND user_id = v_uid;
END;
$$;

ALTER FUNCTION "public"."decline_friend_request"("p_request_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."decline_friend_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."decline_friend_request"("p_request_id" "uuid") TO "authenticated";

-- ============================================================================
-- remove_friend(p_friend_user_id): deletes the ONE canonical friendship
-- row. Never deletes profiles/accounts, never deletes friend_requests
-- history.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."remove_friend"("p_friend_user_id" "uuid")
RETURNS "void"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'remove_friend requires an authenticated user';
  END IF;
  IF p_friend_user_id IS NULL OR p_friend_user_id = v_uid THEN
    RAISE EXCEPTION 'remove_friend: a real friend is required';
  END IF;

  DELETE FROM public.friendships
  WHERE user_one_id = LEAST(v_uid, p_friend_user_id) AND user_two_id = GREATEST(v_uid, p_friend_user_id);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RAISE EXCEPTION 'You are not friends with this user';
  END IF;
END;
$$;

ALTER FUNCTION "public"."remove_friend"("p_friend_user_id" "uuid") OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."remove_friend"("p_friend_user_id" "uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."remove_friend"("p_friend_user_id" "uuid") TO "authenticated";
