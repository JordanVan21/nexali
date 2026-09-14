-- Backend Part 7: real Supabase-backed Notifications schema + preferences.
-- Replaces the frontend-only Notifications page (empty useState seed, no
-- backend) with real, owner-scoped, RLS-protected tables. See
-- docs/BACKEND_AUDIT_REPORT.md Backend Part 7 for the full design writeup.
--
-- Field list below is deliberately the exact set the real frontend
-- (src/lib/notifications.ts's NotificationItemData / NotificationAction,
-- src/pages/Notifications.tsx's filter tabs and day-grouping) already
-- needs -- not a speculative superset. No `metadata jsonb` column: nothing
-- in the current frontend or the budget-threshold producer (see the
-- companion migration 20260918000100) needs unstructured payload storage,
-- so it is omitted rather than added "just in case".

-- ============================================================================
-- notifications: one row per notification, owned by the recipient user.
-- ============================================================================
CREATE TABLE "public"."notifications" (
    "id" "uuid" NOT NULL DEFAULT "gen_random_uuid"(),
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- Exactly the four values src/lib/notifications.ts's NotificationType
    -- union already allows today. "assistant" is included so the type
    -- system/frontend filter tab stay valid even though no producer writes
    -- assistant rows yet (Aura backend doesn't exist -- see Part O of the
    -- task spec); the table supporting the type is not the same as a
    -- producer existing for it.
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    -- Optional call-to-action links, mirroring NotificationItemData's
    -- primaryAction/secondaryAction. Constrained below to internal
    -- relative routes only -- never an absolute/external URL -- so a
    -- notification can never become an open redirect.
    "action_href" "text",
    "action_label" "text",
    "secondary_action_href" "text",
    "secondary_action_label" "text",
    -- Idempotency key for server-generated notifications (see the budget
    -- producer migration). NULL for any notification without a dedupe
    -- requirement -- Postgres UNIQUE constraints treat NULLs as distinct
    -- from one another, so this never restricts non-deduped rows.
    "dedupe_key" "text",
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    -- Read state: a single nullable timestamp rather than a separate
    -- boolean, so "read" and "when" are never two sources of truth that
    -- could drift apart. isRead is derived client-side as read_at IS NOT NULL.
    "read_at" timestamp with time zone,
    -- Dismiss state: durable (dismissed_at), not a hard DELETE, so
    -- dismissal history survives -- a refresh must never resurrect a
    -- dismissed notification back into the visible feed.
    "dismissed_at" timestamp with time zone,
    CONSTRAINT "notifications_type_check" CHECK ("type" = ANY (ARRAY['financial'::"text", 'security'::"text", 'system'::"text", 'assistant'::"text"])),
    CONSTRAINT "notifications_action_href_safe" CHECK ("action_href" IS NULL OR ("action_href" LIKE '/%' AND "action_href" NOT LIKE '//%')),
    CONSTRAINT "notifications_secondary_action_href_safe" CHECK ("secondary_action_href" IS NULL OR ("secondary_action_href" LIKE '/%' AND "secondary_action_href" NOT LIKE '//%')),
    CONSTRAINT "notifications_action_pair" CHECK (("action_href" IS NULL) = ("action_label" IS NULL)),
    CONSTRAINT "notifications_secondary_action_pair" CHECK (("secondary_action_href" IS NULL) = ("secondary_action_label" IS NULL)),
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_user_dedupe_key" UNIQUE ("user_id", "dedupe_key")
);

ALTER TABLE "public"."notifications" OWNER TO "postgres";

COMMENT ON TABLE "public"."notifications" IS 'Real, owner-scoped notification feed. Rows are written only by trusted SECURITY DEFINER producer functions/triggers or the service role -- authenticated clients may SELECT/UPDATE their own rows but cannot INSERT or DELETE (see GRANTs below), so a browser can never fabricate or erase its own notification history.';
COMMENT ON COLUMN "public"."notifications"."dedupe_key" IS 'Idempotency key for server-generated notifications, e.g. budget:<budget_id>:<year>-<month>:approaching. NULL for notification types with no dedupe requirement.';
COMMENT ON COLUMN "public"."notifications"."read_at" IS 'NULL = unread. Set once, to the time the user marked this notification read.';
COMMENT ON COLUMN "public"."notifications"."dismissed_at" IS 'NULL = still in the active feed. Dismissal is durable (not a DELETE) so history survives, but dismissed rows are excluded from the normal feed/unread count.';

-- Feed query pattern: this user's non-dismissed notifications, newest first.
CREATE INDEX "notifications_feed_idx" ON "public"."notifications" ("user_id", "created_at" DESC) WHERE ("dismissed_at" IS NULL);

-- Unread-count pattern: this user's non-dismissed, unread rows.
CREATE INDEX "notifications_unread_idx" ON "public"."notifications" ("user_id") WHERE ("dismissed_at" IS NULL AND "read_at" IS NULL);

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
-- Deliberately no INSERT or DELETE policy for authenticated users: a
-- browser must never be the authority that decides "you exceeded your
-- budget" or fabricates/erases its own notification history. All writes
-- come from SECURITY DEFINER producer functions (table owner, bypasses
-- RLS by design -- same pattern as handle_new_user()) or service_role.
-- "Mark read"/"mark all read"/"dismiss" are all UPDATEs (read_at/
-- dismissed_at), never INSERT/DELETE, so the UPDATE policy above is
-- sufficient for every real user-initiated mutation.

-- Surgical GRANTs (not the baseline schema's blanket `GRANT ALL ... TO
-- anon/authenticated`) -- mirrors the explicit REVOKE/GRANT discipline
-- established in 20260913000000_secure_delete_user_rpc.sql. authenticated
-- gets exactly the operations real users need (SELECT, UPDATE); no INSERT,
-- no DELETE, and no grant to anon at all.
REVOKE ALL ON TABLE "public"."notifications" FROM PUBLIC;
GRANT SELECT, UPDATE ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";

-- ============================================================================
-- notification_preferences: one row per user, backing Settings' four
-- notification switches (Budget approaching limit / Budget exceeded /
-- Monthly financial summary / Account and security notifications -- see
-- src/pages/Settings.tsx's NOTIFICATION_PREFERENCE_ROWS for the exact
-- labels). A separate table rather than more `profiles` columns: these
-- rows describe notification DELIVERY behavior, not user identity, and
-- (unlike profiles) never need to be read by every other page that shows
-- a name/avatar.
-- ============================================================================
CREATE TABLE "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- Defaults: all four ON. The Settings switches were shown unchecked
    -- pre-Part-7, but that reflected the ABSENCE of any real backing value
    -- (every row was hard `disabled`/`checked={false}` regardless of user
    -- intent), not a deliberate opt-out -- there was no real preference yet
    -- to preserve. Budget/security alerts are conventionally opt-out
    -- (default-on) product behavior, matching how the notification types
    -- are described elsewhere in the app (e.g. Notifications' own empty
    -- state copy: "Budget alerts, security events... will show up here as
    -- they happen").
    "budget_approaching" boolean NOT NULL DEFAULT true,
    "budget_exceeded" boolean NOT NULL DEFAULT true,
    "monthly_summary" boolean NOT NULL DEFAULT true,
    "account_security" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT "now"(),
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";

COMMENT ON TABLE "public"."notification_preferences" IS 'One row per user, backing Settings'' four notification switches. Auto-created by handle_new_user() for new signups and backfilled below for existing users -- never requires the client to create its own row.';

ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification preferences" ON "public"."notification_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own notification preferences" ON "public"."notification_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
-- INSERT is granted (unlike notifications) as a defensive fallback only --
-- normal operation never requires the client to insert its own row, since
-- handle_new_user() and the backfill below already guarantee one exists,
-- but an owner-scoped upsert is harmless (a user can only ever create
-- their OWN preferences row) and avoids a hard failure if a row were ever
-- somehow missing.
CREATE POLICY "Users can create their own notification preferences" ON "public"."notification_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

REVOKE ALL ON TABLE "public"."notification_preferences" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";

-- updated_at maintenance -- same trigger-per-table pattern already
-- available in this schema for touching a row's own updated_at on write.
CREATE OR REPLACE FUNCTION "public"."touch_notification_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."touch_notification_preferences_updated_at"() OWNER TO "postgres";

CREATE TRIGGER "notification_preferences_set_updated_at"
    BEFORE UPDATE ON "public"."notification_preferences"
    FOR EACH ROW EXECUTE FUNCTION "public"."touch_notification_preferences_updated_at"();

-- ============================================================================
-- Auto-creation: extend the existing handle_new_user() trigger function
-- (CREATE OR REPLACE -- a new migration, not an edit to the historical
-- one) so every new signup gets a default notification_preferences row for
-- free, the same way it already gets a default profiles row. Existing
-- users are backfilled once, below.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.notification_preferences (user_id)
  values (new.id);

  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

-- Backfill: every existing auth user without a preferences row yet gets
-- one now, with the same real defaults handle_new_user() gives new
-- signups -- deterministic, not a manual per-user step.
INSERT INTO "public"."notification_preferences" ("user_id")
SELECT "u"."id" FROM "auth"."users" "u"
LEFT JOIN "public"."notification_preferences" "np" ON "np"."user_id" = "u"."id"
WHERE "np"."user_id" IS NULL;
