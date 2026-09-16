-- Backend Part 8 (Friends): integrate friend requests with the EXISTING
-- Backend Part 7 Notifications architecture -- no second notification
-- system, no change to notifications' read/dismiss/unread-count semantics,
-- no change to notification_preferences. This is additive only: one new
-- allowed `type` value and one new nullable reference column.
--
-- This is a NEW forward migration, not an edit to any deployed Part 7
-- migration (20260917000000/20260918000000/50/100/200) -- those files are
-- untouched.

-- Widen the type CHECK constraint to allow 'friend_request' alongside the
-- four existing values. Dropping and recreating a CHECK constraint is safe
-- here: it does not touch existing row data (every existing row already
-- satisfies the widened constraint, since it's a superset of the old one),
-- and this migration only ever WIDENS the allowed set, never narrows it.
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_type_check";
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_type_check"
    CHECK ("type" = ANY (ARRAY['financial'::"text", 'security'::"text", 'system'::"text", 'assistant'::"text", 'friend_request'::"text"]));

-- Safely identifies which friend_requests row a friend-request notification
-- is about, so Accept/Decline (triggered from either the Friends page's
-- Friend Requests section OR a friend-request notification card) always
-- act on the correct, real server record -- a dedicated FK reference is
-- preferable to encoding the id inside `description` or a jsonb blob (no
-- `metadata` column exists on `notifications` at all -- see Backend Part 7 --
-- and parsing an id back out of human-readable prose would be fragile).
--
-- ON DELETE SET NULL (not CASCADE): friend_requests rows are kept
-- permanently as history and are only ever deleted via account-deletion
-- cascade (see delete_user_everything's Part 8 update). If a SENDER's
-- account is deleted, their friend_requests rows disappear via that
-- account's own cascade -- but the notification this column points to
-- belongs to the RECIPIENT (a different, still-existing user). Cascading
-- the delete onto their notification row would erase a still-relevant
-- piece of THEIR history as an unexpected side effect of someone else's
-- account deletion; SET NULL keeps the notification (and its
-- already-human-readable title/description) intact and merely drops the
-- now-dangling reference.
ALTER TABLE "public"."notifications"
    ADD COLUMN "friend_request_id" "uuid" REFERENCES "public"."friend_requests"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."notifications"."friend_request_id" IS 'For type=''friend_request'' notifications: the specific friend_requests row this notification is about. NULL for every other notification type, and set to NULL if the underlying request is ever removed via account-deletion cascade (see migration header).';

-- Query pattern: "does this specific notification reference a specific
-- friend request" (used when accept/decline resolve the associated
-- notification, and when the Notifications page cross-references a
-- friend_request-typed row against the real pending-request list to
-- render it actionably). A plain btree index on the FK column is enough --
-- this is a targeted equality lookup, not a range/order query.
CREATE INDEX "notifications_friend_request_id_idx" ON "public"."notifications" ("friend_request_id") WHERE ("friend_request_id" IS NOT NULL);
