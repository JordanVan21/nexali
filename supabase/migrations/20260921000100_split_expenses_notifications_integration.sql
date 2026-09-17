-- Split Expenses backend, Part 2: integrate with the EXISTING Notifications
-- backend (Backend Part 7/8) -- no second notification system, no change to
-- read/dismiss/unread-count semantics, no change to notification_preferences.
-- Additive only, exactly mirroring 20260919000100_friends_notification_integration.sql's
-- own pattern: one new allowed `type` value and one new nullable reference
-- column. This is a NEW forward migration -- no deployed migration is edited.

ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_type_check";
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_type_check"
    CHECK ("type" = ANY (ARRAY['financial'::"text", 'security'::"text", 'system'::"text", 'assistant'::"text", 'friend_request'::"text", 'split_expense'::"text"]));

-- Identifies exactly which split this split_expense notification is about
-- -- a normalized, authorization-relevant reference stored directly on the
-- row, never only inside freeform description text or a jsonb blob
-- (matching friend_request_id's established pattern). Deliberately
-- split_expense_id (the split's own id), NOT split_participant_id: the
-- frontend's accept_split_expense(p_split_id)/decline_split_expense(p_split_id)
-- RPCs take the SPLIT id directly, and split_participants has no direct
-- table grant for `authenticated` to resolve one from the other client-side
-- (RPC-only surface, matching the Friends backend's own pattern) -- storing
-- the split id directly avoids that indirection entirely. ON DELETE
-- CASCADE: unlike friend_request_id/a friend-removed-later scenario, a
-- split_expense notification has no meaning at all once its split is gone
-- (there is no other identifying context in the description worth
-- preserving), so the notification is removed with it rather than left
-- dangling.
ALTER TABLE "public"."notifications"
    ADD COLUMN "split_expense_id" "uuid" REFERENCES "public"."split_expenses"("id") ON DELETE CASCADE;

COMMENT ON COLUMN "public"."notifications"."split_expense_id" IS 'For type=''split_expense'' notifications: the specific split_expenses row this notification is about. NULL for every other type.';

CREATE INDEX "notifications_split_expense_id_idx" ON "public"."notifications" ("split_expense_id") WHERE ("split_expense_id" IS NOT NULL);
