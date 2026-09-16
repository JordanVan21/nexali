import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Static verification of the four Backend Part 8 (Friends) migrations, the
 * same documented alternative used for
 * ../settings/atomicSettingsMigration.test.ts: there is no local/CI
 * Postgres wired to Vitest, so this suite reads the migration SQL files
 * directly and asserts the specific invariants the task called out --
 * self-request/self-friendship prevention, the canonical-pair
 * uniqueness/race-condition backstop, RLS being enabled with no unsafe
 * `authenticated` grant on either table, and every RPC's auth.uid()-only /
 * REVOKE-then-GRANT security discipline.
 */
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../supabase/migrations");

function readMigration(filename: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
}

describe("20260919000000_friends_schema.sql (schema, canonical pair, RLS/grants)", () => {
  const FILE = "20260919000000_friends_schema.sql";

  it("prevents a self friend request at the database level", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CONSTRAINT "friend_requests_no_self" CHECK \("sender_id" <> "recipient_id"\)/);
  });

  it("prevents a self friendship at the database level", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CONSTRAINT "friendships_no_self" CHECK \("user_one_id" <> "user_two_id"\)/);
  });

  it("enforces canonical pair ordering on friendships (user_one_id < user_two_id), the real anti-duplicate-mirror backstop", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CONSTRAINT "friendships_canonical_order" CHECK \("user_one_id" < "user_two_id"\)/);
    expect(sql).toMatch(/CONSTRAINT "friendships_unique_pair" UNIQUE \("user_one_id", "user_two_id"\)/);
  });

  it("prevents symmetric duplicate pending requests (A->B and B->A) via a partial unique index on LEAST/GREATEST", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "friend_requests_pending_pair_uidx"\s*\n\s*ON "public"\."friend_requests" \(LEAST\("sender_id", "recipient_id"\), GREATEST\("sender_id", "recipient_id"\)\)\s*\n\s*WHERE \("status" = 'pending'\)/
    );
  });

  it("restricts friend_requests.status to the 3-state model only (no cancelled/blocking states)", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(
      /CONSTRAINT "friend_requests_status_check" CHECK \("status" = ANY \(ARRAY\['pending'::"text", 'accepted'::"text", 'declined'::"text"\]\)\)/
    );
  });

  it("both tables cascade-delete when the referenced auth.users row is deleted", () => {
    const sql = readMigration(FILE);
    const cascadeRefs = sql.match(/REFERENCES "auth"."users"\("id"\) ON DELETE CASCADE/g) ?? [];
    expect(cascadeRefs.length).toBe(4); // sender_id, recipient_id, user_one_id, user_two_id
  });

  it("enables RLS on both tables", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/ALTER TABLE "public"\."friend_requests" ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE "public"\."friendships" ENABLE ROW LEVEL SECURITY/);
  });

  it("grants no direct table access to authenticated on either table (RPC-only surface)", () => {
    const sql = readMigration(FILE);
    expect(sql).not.toMatch(/GRANT[\s\S]*?ON TABLE "public"\."friend_requests"[\s\S]*?TO "authenticated"/);
    expect(sql).not.toMatch(/GRANT[\s\S]*?ON TABLE "public"\."friendships"[\s\S]*?TO "authenticated"/);
    expect(sql).not.toMatch(/TO "anon"/);
  });

  it("revokes PUBLIC access on both tables and grants only to service_role", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/REVOKE ALL ON TABLE "public"\."friend_requests" FROM PUBLIC/);
    expect(sql).toMatch(/GRANT ALL ON TABLE "public"\."friend_requests" TO "service_role"/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE "public"\."friendships" FROM PUBLIC/);
    expect(sql).toMatch(/GRANT ALL ON TABLE "public"\."friendships" TO "service_role"/);
  });

  it("real access-pattern indexes exist: pending-by-recipient, pending-by-sender, friendships-by-either-user-column", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CREATE INDEX "friend_requests_pending_recipient_idx"/);
    expect(sql).toMatch(/CREATE INDEX "friend_requests_pending_sender_idx"/);
    expect(sql).toMatch(/CREATE INDEX "friendships_user_one_idx"/);
    expect(sql).toMatch(/CREATE INDEX "friendships_user_two_idx"/);
  });
});

describe("20260919000100_friends_notification_integration.sql (Notifications reuse, not a second system)", () => {
  const FILE = "20260919000100_friends_notification_integration.sql";

  it("widens the existing type CHECK to add 'friend_request' rather than replacing the whole model", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/DROP CONSTRAINT "notifications_type_check"/);
    expect(sql).toMatch(
      /CHECK \("type" = ANY \(ARRAY\['financial'::"text", 'security'::"text", 'system'::"text", 'assistant'::"text", 'friend_request'::"text"\]\)\)/
    );
  });

  it("adds a nullable friend_request_id reference column with ON DELETE SET NULL (not CASCADE)", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(
      /ADD COLUMN "friend_request_id" "uuid" REFERENCES "public"\."friend_requests"\("id"\) ON DELETE SET NULL/
    );
  });

  it("does not touch notification_preferences (no new toggle added) -- no DDL statement references that table", () => {
    const sql = readMigration(FILE);
    expect(sql).not.toMatch(/ALTER TABLE "public"\."notification_preferences"/);
    expect(sql).not.toMatch(/CREATE .*notification_preferences/);
  });

  it("adds a supporting index on the new reference column", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CREATE INDEX "notifications_friend_request_id_idx" ON "public"\."notifications" \("friend_request_id"\)/);
  });
});

describe("20260919000200_friends_rpcs.sql (8 RPCs: security + behavior discipline)", () => {
  const FILE = "20260919000200_friends_rpcs.sql";
  const FUNCTION_NAMES = [
    "search_nexali_users",
    "list_friends",
    "list_incoming_friend_requests",
    "get_incoming_friend_request_count",
    "send_friend_request",
    "accept_friend_request",
    "decline_friend_request",
    "remove_friend",
  ];

  it("defines exactly these 8 functions, each exactly once", () => {
    const sql = readMigration(FILE);
    for (const name of FUNCTION_NAMES) {
      const matches = sql.match(new RegExp(`CREATE OR REPLACE FUNCTION "public"\\."${name}"`, "g")) ?? [];
      expect(matches, `${name} should be defined exactly once`).toHaveLength(1);
    }
  });

  it("every function derives identity only from auth.uid() -- none accepts a caller-id parameter", () => {
    const sql = readMigration(FILE);
    for (const name of FUNCTION_NAMES) {
      const sigStart = sql.indexOf(`CREATE OR REPLACE FUNCTION "public"."${name}"(`);
      const sigEnd = sql.indexOf(")", sigStart);
      const signature = sql.slice(sigStart, sigEnd);
      expect(signature, `${name}'s parameter list should not accept a caller/user id`).not.toMatch(/p_user_id|p_caller_id|p_uid/);

      const bodyStart = sql.indexOf("AS $$", sigStart);
      const bodyEnd = sql.indexOf("\n$$;", bodyStart);
      const body = sql.slice(bodyStart, bodyEnd);
      expect(body, `${name} should derive identity from auth.uid()`).toMatch(/auth\.uid\(\)/);
    }
  });

  it("every function rejects a null auth.uid() with a real exception", () => {
    const sql = readMigration(FILE);
    for (const name of FUNCTION_NAMES) {
      const start = sql.indexOf(`CREATE OR REPLACE FUNCTION "public"."${name}"`);
      const nextStart = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."', start + 1);
      const chunk = nextStart === -1 ? sql.slice(start) : sql.slice(start, nextStart);
      expect(chunk, `${name} should raise when auth.uid() IS NULL`).toMatch(/IF v_uid IS NULL THEN\s*\n\s*RAISE EXCEPTION/);
    }
  });

  it("every function is SECURITY DEFINER with a pinned safe search_path", () => {
    const sql = readMigration(FILE);
    for (const name of FUNCTION_NAMES) {
      const start = sql.indexOf(`CREATE OR REPLACE FUNCTION "public"."${name}"`);
      const nextStart = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."', start + 1);
      const chunk = nextStart === -1 ? sql.slice(start) : sql.slice(start, nextStart);
      expect(chunk, `${name} should be SECURITY DEFINER`).toMatch(/SECURITY DEFINER/);
      expect(chunk, `${name} should pin search_path`).toMatch(/SET "search_path" TO 'public', 'pg_temp'/);
    }
  });

  it("every function revokes PUBLIC execute and grants only to authenticated (no anon grant anywhere in the file)", () => {
    const sql = readMigration(FILE);
    for (const name of FUNCTION_NAMES) {
      const revokePattern = new RegExp(`REVOKE ALL ON FUNCTION "public"\\."${name}"\\([^)]*\\) FROM PUBLIC`);
      const grantPattern = new RegExp(`GRANT EXECUTE ON FUNCTION "public"\\."${name}"\\([^)]*\\) TO "authenticated"`);
      expect(sql, `${name} should REVOKE FROM PUBLIC`).toMatch(revokePattern);
      expect(sql, `${name} should GRANT EXECUTE TO authenticated`).toMatch(grantPattern);
    }
    expect(sql).not.toMatch(/TO "anon"/);
  });

  it("search_nexali_users proves email privacy in SQL itself (CASE-to-NULL on non-exact match), not merely returning it unconditionally", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CASE WHEN lower\(trim\(u\.email\)\) = v_query THEN u\.email ELSE NULL END/);
  });

  it("search_nexali_users matches names via strpos (no ILIKE/wildcard interpolation of the raw query)", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."search_nexali_users"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."list_friends"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/strpos\(lower\(coalesce\(p\.full_name, ''\)\), v_query\) > 0/);
    expect(body).not.toMatch(/ILIKE/);
  });

  it("search_nexali_users excludes the caller from their own results and bounds with a real LIMIT", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."search_nexali_users"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."list_friends"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/WHERE p\.id <> v_uid/);
    expect(body).toMatch(/LIMIT 20/);
  });

  it("search_nexali_users enforces the 2-character minimum server-side, not merely trusting the frontend debounce", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."search_nexali_users"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."list_friends"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/IF length\(v_query\) < 2 THEN\s*\n\s*RETURN;/);
  });

  it("list_incoming_friend_requests never selects the sender's email", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."list_incoming_friend_requests"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."get_incoming_friend_request_count"');
    const body = sql.slice(start, end);
    expect(body).not.toMatch(/email/i);
  });

  it("get_incoming_friend_request_count runs a real count(*) query, not a fetch-all", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."get_incoming_friend_request_count"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."send_friend_request"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/SELECT count\(\*\) INTO v_count/);
  });

  it("send_friend_request rejects self-requests, missing recipients, existing friendships, and both pending directions", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."send_friend_request"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_friend_request"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/IF p_recipient_id = v_uid THEN\s*\n\s*RAISE EXCEPTION 'You cannot send a friend request to yourself'/);
    expect(body).toMatch(/RAISE EXCEPTION 'That Nexali user could not be found'/);
    expect(body).toMatch(/RAISE EXCEPTION 'You are already friends with this user'/);
    expect(body).toMatch(/RAISE EXCEPTION 'A friend request is already pending'/);
  });

  it("send_friend_request does NOT auto-accept a reverse-pending request -- it raises a distinct, safe error instead", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."send_friend_request"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_friend_request"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/already sent you a friend request/);
    expect(body).not.toMatch(/UPDATE public\.friend_requests[\s\S]*?SET status = 'accepted'/);
    expect(body).not.toMatch(/INSERT INTO public\.friendships/);
  });

  it("send_friend_request has a unique_violation EXCEPTION handler as the real race-condition backstop", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."send_friend_request"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_friend_request"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/EXCEPTION\s*\n\s*WHEN unique_violation THEN/);
  });

  it("send_friend_request creates the request and the recipient's notification atomically in one function body", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."send_friend_request"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_friend_request"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/INSERT INTO public\.friend_requests/);
    expect(body).toMatch(/INSERT INTO public\.notifications[\s\S]*?'friend_request'/);
  });

  it("accept_friend_request row-locks with FOR UPDATE, validates recipient-only, and is idempotent on an already-accepted request", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_friend_request"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."decline_friend_request"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/FOR UPDATE/);
    expect(body).toMatch(/IF v_req\.recipient_id <> v_uid THEN\s*\n\s*RAISE EXCEPTION 'Only the recipient can accept this request'/);
    expect(body).toMatch(/IF v_req\.status = 'accepted' THEN\s*\n\s*-- Idempotent/);
  });

  it("accept_friend_request creates the friendship via canonical LEAST/GREATEST with ON CONFLICT DO NOTHING", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_friend_request"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."decline_friend_request"');
    const body = sql.slice(start, end);
    expect(body).toMatch(
      /INSERT INTO public\.friendships \(user_one_id, user_two_id\)\s*\n\s*VALUES \(LEAST\(v_req\.sender_id, v_req\.recipient_id\), GREATEST\(v_req\.sender_id, v_req\.recipient_id\)\)\s*\n\s*ON CONFLICT \(user_one_id, user_two_id\) DO NOTHING/
    );
  });

  it("accept_friend_request resolves (reads + dismisses) the associated notification in the same transaction", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_friend_request"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."decline_friend_request"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/UPDATE public\.notifications\s*\n\s*SET read_at = coalesce\(read_at, now\(\)\), dismissed_at = coalesce\(dismissed_at, now\(\)\)\s*\n\s*WHERE friend_request_id = p_request_id AND user_id = v_uid/);
  });

  it("decline_friend_request mirrors accept but never creates a friendship", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."decline_friend_request"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."remove_friend"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/FOR UPDATE/);
    expect(body).toMatch(/RAISE EXCEPTION 'Only the recipient can decline this request'/);
    expect(body).toMatch(/SET status = 'declined', responded_at = now\(\)/);
    expect(body).not.toMatch(/INSERT INTO public\.friendships/);
  });

  it("remove_friend deletes exactly the one canonical friendship row (via LEAST/GREATEST) and raises if nothing was deleted", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."remove_friend"');
    const body = sql.slice(start);
    expect(body).toMatch(
      /DELETE FROM public\.friendships\s*\n\s*WHERE user_one_id = LEAST\(v_uid, p_friend_user_id\) AND user_two_id = GREATEST\(v_uid, p_friend_user_id\)/
    );
    expect(body).toMatch(/GET DIAGNOSTICS v_deleted = ROW_COUNT/);
    expect(body).toMatch(/RAISE EXCEPTION 'You are not friends with this user'/);
    expect(body).not.toMatch(/DELETE FROM public\.profiles/);
    expect(body).not.toMatch(/DELETE FROM public\.friend_requests/);
  });
});

describe("20260919000300_delete_user_everything_friends_cleanup.sql (account deletion cleanup)", () => {
  const FILE = "20260919000300_delete_user_everything_friends_cleanup.sql";

  it("deletes both friend_requests (either side) and friendships (either column) for the deleted user", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/delete from friend_requests\s+where sender_id = p_user_id or recipient_id = p_user_id;/);
    expect(sql).toMatch(/delete from friendships\s+where user_one_id = p_user_id or user_two_id = p_user_id;/);
  });

  it("keeps the existing service_role-only guard unchanged", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/if auth\.role\(\) is distinct from 'service_role' then/);
    expect(sql).toMatch(/raise exception 'delete_user_everything can only be called by the service role'/);
  });

  it("still deletes the pre-existing app tables (this is a forward migration extending, not replacing, the original)", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/delete from notifications\s+where user_id = p_user_id;/);
    expect(sql).toMatch(/delete from notification_preferences\s+where user_id = p_user_id;/);
    expect(sql).toMatch(/delete from transactions where user_id = p_user_id;/);
    expect(sql).toMatch(/delete from budgets\s+where user_id = p_user_id;/);
    expect(sql).toMatch(/delete from categories\s+where user_id = p_user_id;/);
    expect(sql).toMatch(/delete from profiles\s+where id\s+= p_user_id;/);
  });

  it("keeps EXECUTE revoked from authenticated/anon/PUBLIC, granted only to service_role", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION "public"\."delete_user_everything"\("p_user_id" "uuid"\) FROM PUBLIC/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION "public"\."delete_user_everything"\("p_user_id" "uuid"\) FROM "anon"/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION "public"\."delete_user_everything"\("p_user_id" "uuid"\) FROM "authenticated"/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION "public"\."delete_user_everything"\("p_user_id" "uuid"\) TO "service_role"/);
  });
});
