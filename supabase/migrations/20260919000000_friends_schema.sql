-- Backend Part 8 (Friends): friend_requests + friendships schema.
--
-- Replaces the Friends frontend's mock/local-only relationship state with a
-- real, secure Supabase-backed data model. Identity comes entirely from
-- `auth.users`/`public.profiles` -- no duplicate user-profile table is
-- created (per the task's explicit instruction).
--
-- ARCHITECTURE: both tables are RPC-ONLY from the client's perspective.
-- RLS is enabled on both (defense in depth, and so a future, deliberately
-- broadened grant would immediately be correctly scoped), but NO direct
-- table privileges are granted to `authenticated` here -- every real read
-- (search, list friends, list/count incoming requests) and every mutation
-- (send/accept/decline/remove) goes through a narrowly-scoped
-- SECURITY DEFINER function (see 20260919000200_friends_rpcs.sql). This
-- matches the task's explicit preference: "Prefer server-authorized RPC
-- mutations... If direct SELECT is unnecessary because list/count RPCs
-- exist: keep that surface closed too." SECURITY DEFINER functions run as
-- their owner (bypassing RLS), so this closed-grant model does not block
-- any RPC from working.

-- ============================================================================
-- friend_requests: one row per request, kept forever (accepted/declined
-- requests are real history, not deleted -- see the RPCs' doc comments).
-- ============================================================================
CREATE TABLE "public"."friend_requests" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "sender_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "recipient_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "status" "text" NOT NULL DEFAULT 'pending',
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    -- NULL while pending; set the instant the recipient accepts or declines.
    "responded_at" timestamp with time zone,
    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "friend_requests_status_check" CHECK ("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])),
    -- No self-requests, ever -- checked here AND defensively re-checked in
    -- send_friend_request() for a clearer application-level error message.
    CONSTRAINT "friend_requests_no_self" CHECK ("sender_id" <> "recipient_id")
);

ALTER TABLE "public"."friend_requests" OWNER TO "postgres";

COMMENT ON TABLE "public"."friend_requests" IS 'One row per friend request, kept permanently as history once accepted/declined. RPC-only surface -- see the module header in this migration for why no direct table grant exists for authenticated.';

-- Never two PENDING requests between the same unordered pair at once, in
-- EITHER direction -- this is the real, race-condition-proof enforcement
-- of "A->B pending and B->A pending must never coexist" (send_friend_request()
-- also pre-checks this for a friendlier error message, but this partial
-- unique index is the actual backstop: a second concurrent INSERT for the
-- same pair fails atomically at the database level, not via a
-- read-then-write race in application code). Declined/accepted requests
-- are excluded (WHERE status = 'pending'), so a new request can always be
-- sent again after a decline, or naturally can't after an accept (blocked
-- instead by the friendships uniqueness check in send_friend_request()).
CREATE UNIQUE INDEX "friend_requests_pending_pair_uidx"
    ON "public"."friend_requests" (LEAST("sender_id", "recipient_id"), GREATEST("sender_id", "recipient_id"))
    WHERE ("status" = 'pending');

-- Real access patterns: "my pending incoming requests, newest first" (the
-- Friends page's Friend Requests section + the incoming-count RPC) and "do
-- I already have a pending outgoing request to this person" (send_friend_request()'s
-- own pre-check). Both are partial indexes scoped to status='pending' --
-- the only status either access pattern ever queries.
CREATE INDEX "friend_requests_pending_recipient_idx"
    ON "public"."friend_requests" ("recipient_id", "created_at" DESC)
    WHERE ("status" = 'pending');

CREATE INDEX "friend_requests_pending_sender_idx"
    ON "public"."friend_requests" ("sender_id")
    WHERE ("status" = 'pending');

ALTER TABLE "public"."friend_requests" ENABLE ROW LEVEL SECURITY;

-- Defensive-in-depth only (see module header) -- inert today since
-- `authenticated` has no table-level grant at all, but correctly scoped
-- (own-involved rows only) if a future change ever adds one.
CREATE POLICY "Users can view their own friend requests" ON "public"."friend_requests"
    FOR SELECT USING (("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "recipient_id"));

REVOKE ALL ON TABLE "public"."friend_requests" FROM PUBLIC;
GRANT ALL ON TABLE "public"."friend_requests" TO "service_role";

-- ============================================================================
-- friendships: ONE canonical row per accepted pair (never two mirrored
-- rows) -- user_one_id is always the lexicographically smaller uuid, user_two_id
-- the larger, enforced by a CHECK constraint so A/B and B/A can never both
-- exist. Every RPC that reads or writes this table computes
-- (LEAST(a,b), GREATEST(a,b)) before touching it, rather than trusting
-- caller-supplied ordering.
-- ============================================================================
CREATE TABLE "public"."friendships" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "user_one_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "user_two_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "friendships_no_self" CHECK ("user_one_id" <> "user_two_id"),
    -- The canonical-order invariant itself -- this is what makes the pair
    -- symmetric-safe: an INSERT with the pair given in the "wrong" order
    -- would violate this CHECK rather than silently creating a duplicate
    -- mirrored row, so every writer MUST pre-sort with LEAST/GREATEST.
    CONSTRAINT "friendships_canonical_order" CHECK ("user_one_id" < "user_two_id"),
    CONSTRAINT "friendships_unique_pair" UNIQUE ("user_one_id", "user_two_id")
);

ALTER TABLE "public"."friendships" OWNER TO "postgres";

COMMENT ON TABLE "public"."friendships" IS 'One canonical row per accepted friend pair (user_one_id < user_two_id, enforced). RPC-only surface, same rationale as friend_requests.';

-- "Friendships containing current user" -- the user can be in either
-- column, so both are indexed for an efficient `user_one_id = X OR
-- user_two_id = X` lookup (list_friends()/remove_friend()/search's
-- friendship check all query this way).
CREATE INDEX "friendships_user_one_idx" ON "public"."friendships" ("user_one_id");
CREATE INDEX "friendships_user_two_idx" ON "public"."friendships" ("user_two_id");

ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships" ON "public"."friendships"
    FOR SELECT USING (("auth"."uid"() = "user_one_id") OR ("auth"."uid"() = "user_two_id"));

REVOKE ALL ON TABLE "public"."friendships" FROM PUBLIC;
GRANT ALL ON TABLE "public"."friendships" TO "service_role";
