import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Static verification of the four Split Expenses backend migrations --
 * the same documented alternative used by every other backend Part's own
 * migration tests (e.g. ../friends/friendsMigrations.test.ts): there is
 * no local/CI Postgres wired to Vitest. Every function/table/RLS/grant
 * assertion here was independently, live-verified against the linked
 * project inside rolled-back transactions before this Part was reported
 * complete -- see docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry for
 * the full live-verification writeup (cross-receipt netting, idempotent
 * replay, accept/decline, every validation rejection path).
 */
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../supabase/migrations");

function readMigration(filename: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
}

describe("20260921000000_split_expenses_schema.sql", () => {
  const FILE = "20260921000000_split_expenses_schema.sql";

  it("creates all seven Split Expenses tables", () => {
    const sql = readMigration(FILE);
    for (const table of [
      "split_expenses",
      "split_participants",
      "split_receipts",
      "split_receipt_items",
      "split_item_allocations",
      "split_settlements",
      "split_generated_transactions",
    ]) {
      expect(sql, `should create ${table}`).toMatch(new RegExp(`CREATE TABLE "public"\\."${table}"`));
    }
  });

  it("uses integer cents (bigint) for every money column, never numeric/float", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/"receipt_total_cents" bigint/);
    expect(sql).toMatch(/"line_total_cents" bigint/);
    expect(sql).toMatch(/"share_cents" bigint/);
    expect(sql).toMatch(/"amount_cents" bigint/);
    expect(sql).toMatch(/"allocated_total_cents" bigint/);
    expect(sql).toMatch(/"paid_total_cents" bigint/);
  });

  it("enforces the idempotency uniqueness backstop: UNIQUE(created_by, idempotency_key)", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CONSTRAINT "split_expenses_creator_idempotency_key" UNIQUE \("created_by", "idempotency_key"\)/);
  });

  it("restricts split_expenses.status and split_participants.response_status to their real state models", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CHECK \("status" = ANY \(ARRAY\['submitted'::"text", 'accepted'::"text", 'needs_attention'::"text"\]\)\)/);
    expect(sql).toMatch(/CHECK \("response_status" = ANY \(ARRAY\['pending'::"text", 'accepted'::"text", 'declined'::"text"\]\)\)/);
  });

  it("split_participants identity is (split_id, user_id), unique", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CONSTRAINT "split_participants_unique_pair" UNIQUE \("split_id", "user_id"\)/);
  });

  it("split_item_allocations is unique per (item_id, user_id) and share_cents must be positive", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CONSTRAINT "split_item_allocations_unique_pair" UNIQUE \("item_id", "user_id"\)/);
    expect(sql).toMatch(/CONSTRAINT "split_item_allocations_share_positive" CHECK \("share_cents" > 0\)/);
  });

  it("split_settlements forbids self-transfers and non-positive amounts, and is unique per (split, from, to)", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CONSTRAINT "split_settlements_no_self_transfer" CHECK \("from_user_id" <> "to_user_id"\)/);
    expect(sql).toMatch(/CONSTRAINT "split_settlements_amount_positive" CHECK \("amount_cents" > 0\)/);
    expect(sql).toMatch(/CONSTRAINT "split_settlements_unique_pair" UNIQUE \("split_id", "from_user_id", "to_user_id"\)/);
  });

  it("split_generated_transactions is the real duplicate-transaction backstop: UNIQUE(receipt_id, user_id)", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CONSTRAINT "split_generated_transactions_unique_receipt_user" UNIQUE \("receipt_id", "user_id"\)/);
  });

  it("every table cascades on the relevant auth.users/split_expenses deletion", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/"created_by" "uuid" NOT NULL REFERENCES "auth"."users"\("id"\) ON DELETE CASCADE/);
    expect(sql).toMatch(/"split_id" "uuid" NOT NULL REFERENCES "public"."split_expenses"\("id"\) ON DELETE CASCADE/);
  });

  it("enables RLS on all seven tables", () => {
    const sql = readMigration(FILE);
    for (const table of [
      "split_expenses",
      "split_participants",
      "split_receipts",
      "split_receipt_items",
      "split_item_allocations",
      "split_settlements",
      "split_generated_transactions",
    ]) {
      expect(sql, `${table} should enable RLS`).toMatch(new RegExp(`ALTER TABLE "public"\\."${table}" ENABLE ROW LEVEL SECURITY`));
    }
  });

  it("grants no direct TABLE access to authenticated on any table (RPC-only surface) -- only service_role", () => {
    const sql = readMigration(FILE);
    expect(sql).not.toMatch(/GRANT ALL ON TABLE "public"\."\w+" TO "authenticated"/);
    expect(sql).not.toMatch(/ON TABLE "public"\."\w+"[\s\S]*?TO "anon"/);
    const tableGrants = sql.match(/GRANT ALL ON TABLE "public"\."\w+" TO "service_role"/g) ?? [];
    expect(tableGrants.length).toBe(7);
  });

  it("defines the three SECURITY DEFINER RLS helper functions used to avoid the split_expenses<->split_participants mutual-policy recursion", () => {
    const sql = readMigration(FILE);
    for (const fn of ["_can_view_split", "_can_view_split_receipt", "_can_view_split_item"]) {
      expect(sql, `${fn} should be SECURITY DEFINER`).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION "public"\\."${fn}"[\\s\\S]*?SECURITY DEFINER`));
    }
  });

  it("every policy uses a helper function, never a raw cross-table EXISTS subquery (the recursion fix)", () => {
    const sql = readMigration(FILE);
    const policiesSection = sql.slice(sql.indexOf("-- Policies --"));
    expect(policiesSection).not.toMatch(/EXISTS \(\s*SELECT 1 FROM "public"\."split_expenses"/);
    expect(policiesSection).not.toMatch(/EXISTS \(\s*SELECT 1 FROM "public"\."split_participants"/);
  });
});

describe("20260921000100_split_expenses_notifications_integration.sql", () => {
  const FILE = "20260921000100_split_expenses_notifications_integration.sql";

  it("widens notifications.type to add split_expense alongside every existing value", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/DROP CONSTRAINT "notifications_type_check"/);
    expect(sql).toMatch(
      /CHECK \("type" = ANY \(ARRAY\['financial'::"text", 'security'::"text", 'system'::"text", 'assistant'::"text", 'friend_request'::"text", 'split_expense'::"text"\]\)\)/
    );
  });

  it("adds split_expense_id (the split's own id, not a participant row id) referencing split_expenses directly", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/ADD COLUMN "split_expense_id" "uuid" REFERENCES "public"\."split_expenses"\("id"\) ON DELETE CASCADE/);
  });

  it("does not touch notification_preferences (no new toggle added)", () => {
    const sql = readMigration(FILE);
    expect(sql).not.toMatch(/ALTER TABLE "public"\."notification_preferences"/);
  });

  it("adds a supporting partial index on the new column", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/CREATE INDEX "notifications_split_expense_id_idx" ON "public"\."notifications" \("split_expense_id"\)/);
  });
});

describe("20260921000200_split_expenses_rpcs.sql", () => {
  const FILE = "20260921000200_split_expenses_rpcs.sql";
  const PUBLIC_RPCS = ["submit_split_expense", "accept_split_expense", "decline_split_expense"];
  const INTERNAL_HELPERS = ["_compute_split_settlements", "_split_expense_summary"];

  it("defines submit_split_expense, accept_split_expense, and decline_split_expense exactly once each", () => {
    const sql = readMigration(FILE);
    for (const fn of PUBLIC_RPCS) {
      const matches = sql.match(new RegExp(`CREATE OR REPLACE FUNCTION "public"\\."${fn}"`, "g")) ?? [];
      expect(matches, `${fn} should be defined exactly once`).toHaveLength(1);
    }
  });

  it("every public RPC derives identity from auth.uid() only, rejects a null caller, is SECURITY DEFINER, and pins search_path", () => {
    const sql = readMigration(FILE);
    for (const fn of PUBLIC_RPCS) {
      const start = sql.indexOf(`CREATE OR REPLACE FUNCTION "public"."${fn}"`);
      const nextStart = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."', start + 1);
      const chunk = nextStart === -1 ? sql.slice(start) : sql.slice(start, nextStart);
      expect(chunk, `${fn} signature must not accept a caller id`).not.toMatch(/"p_user_id"|"p_caller_id"|"p_participant_id"/);
      expect(chunk, `${fn} should derive identity from auth.uid()`).toMatch(/auth\.uid\(\)/);
      expect(chunk, `${fn} should reject a null caller`).toMatch(/IF v_uid IS NULL THEN\s*\n\s*RAISE EXCEPTION/);
      expect(chunk, `${fn} should be SECURITY DEFINER`).toMatch(/SECURITY DEFINER/);
      expect(chunk, `${fn} should pin search_path`).toMatch(/SET "search_path" TO 'public', 'pg_temp'/);
    }
  });

  it("every public RPC revokes PUBLIC execute and grants only to authenticated (no anon grant)", () => {
    const sql = readMigration(FILE);
    for (const fn of PUBLIC_RPCS) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION "public"\\."${fn}"[\\s\\S]*?FROM PUBLIC`));
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION "public"\\."${fn}"[\\s\\S]*?TO "authenticated"`));
    }
    expect(sql).not.toMatch(/TO "anon"/);
  });

  it("internal helper functions (_compute_split_settlements, _split_expense_summary) are never granted to authenticated", () => {
    const sql = readMigration(FILE);
    for (const fn of INTERNAL_HELPERS) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION "public"\\."${fn}"[\\s\\S]*?FROM PUBLIC`));
      expect(sql).not.toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION "public"\\."${fn}"[\\s\\S]*?TO "authenticated"`));
    }
  });

  it("submit_split_expense checks the idempotency key FIRST, before any validation or write, and replays via the internal summary helper", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."submit_split_expense"');
    const idempotencyLookup = sql.indexOf("SELECT id INTO v_existing_id FROM public.split_expenses", start);
    const currencyValidation = sql.indexOf("v_currency IS NULL OR v_currency <> v_creator_currency", start);
    expect(idempotencyLookup).toBeGreaterThan(-1);
    expect(currencyValidation).toBeGreaterThan(idempotencyLookup);
    expect(sql.slice(start)).toMatch(/RETURN public\._split_expense_summary\(v_existing_id\);/);
  });

  it("submit_split_expense validates currency match for the creator AND every other participant (no FX conversion)", () => {
    const sql = readMigration(FILE);
    const matches = sql.match(/Split Expenses currently requires all participants to use the same currency\./g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("submit_split_expense re-validates friendship against the REAL friendships table, never trusting the client", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/EXISTS \(\s*SELECT 1 FROM public\.friendships f\s*WHERE f\.user_one_id = LEAST\(v_uid, v_participant_id\) AND f\.user_two_id = GREATEST\(v_uid, v_participant_id\)/);
  });

  it("submit_split_expense rejects a non-expense or user-owned category", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/IF v_category\.type <> 'expense' THEN/);
    expect(sql).toMatch(/IF v_category\.user_id IS NOT NULL THEN/);
  });

  it("submit_split_expense validates mine=creator-only, someone_else=exactly one, shared=2+ with no duplicates", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/A "mine" item must be assigned to exactly the split creator/);
    expect(sql).toMatch(/A "someone_else" item must be assigned to exactly one participant/);
    expect(sql).toMatch(/A "shared" item must be assigned to at least two participants/);
    expect(sql).toMatch(/A "shared" item cannot list the same participant twice/);
  });

  it("submit_split_expense rejects an item assigned to someone outside the split", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/An item cannot be assigned to someone outside this split/);
  });

  it("submit_split_expense's equal-cents distribution uses the array order the client sent (WITH ORDINALITY), matching the frontend's splitCentsEqually", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/jsonb_array_elements_text\(v_item->'participantIds'\) WITH ORDINALITY AS elem\(value, ord\)/);
    expect(sql).toMatch(/\(v_line_total \/ v_n\) \+ \(CASE WHEN elem\.ord <= \(v_line_total % v_n\) THEN 1 ELSE 0 END\)/);
  });

  it("submit_split_expense validates receipt items sum to the receipt total", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/IF v_receipt_items_sum <> v_receipt_total THEN\s*\n\s*RAISE EXCEPTION 'Receipt items do not add up to the receipt total'/);
  });

  it("submit_split_expense has a paid==allocated reconciliation safety net", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/RAISE EXCEPTION 'Split totals do not reconcile'/);
  });

  it("submit_split_expense creates the CREATOR's own transactions immediately, one per receipt (grouped), never one per item", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."submit_split_expense"');
    const chunk = sql.slice(start, sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_split_expense"'));
    expect(chunk).toMatch(/GROUP BY sr\.id, sr\.merchant, sr\.receipt_date, sr\.category_id/);
    expect(chunk).toMatch(/INSERT INTO public\.transactions/);
    expect(chunk).toMatch(/'Split expense'/);
  });

  it("submit_split_expense converts the receipt date to noon in the TARGET user's own configured timezone, not the browser's", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/\(v_gen_row\.receipt_date \+ time '12:00'\) AT TIME ZONE v_target_tz/);
    expect(sql).toMatch(/SELECT COALESCE\(timezone, 'UTC'\) INTO v_target_tz FROM public\.profiles WHERE id = v_uid/);
  });

  it("submit_split_expense sends exactly one notification per OTHER participant (never the creator), showing only their own share", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/WHERE sp\.split_id = v_split_id AND sp\.user_id <> v_uid;/);
    expect(sql).toMatch(/'split:' \|\| v_split_id::text \|\| ':participant:' \|\| sp\.user_id::text/);
  });

  it("accept_split_expense's WHERE clause (auth.uid() = user_id) is the entire cross-user authorization boundary -- no p_user_id parameter exists to bypass it", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_split_expense"');
    const chunk = sql.slice(start, sql.indexOf('CREATE OR REPLACE FUNCTION "public"."decline_split_expense"'));
    expect(chunk).toMatch(/WHERE split_id = p_split_id AND user_id = v_uid FOR UPDATE/);
  });

  it("accept_split_expense is idempotent on an already-accepted participant (no duplicate transactions)", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_split_expense"');
    const chunk = sql.slice(start, sql.indexOf('CREATE OR REPLACE FUNCTION "public"."decline_split_expense"'));
    expect(chunk).toMatch(/IF v_participant\.response_status = 'accepted' THEN\s*\n\s*RETURN public\._split_expense_summary/);
    expect(chunk).toMatch(/ON CONFLICT \(receipt_id, user_id\) DO NOTHING/);
  });

  it("accept_split_expense finalizes the split to 'accepted' only once every non-creator participant has accepted, and never overwrites 'needs_attention'", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."accept_split_expense"');
    const chunk = sql.slice(start, sql.indexOf('CREATE OR REPLACE FUNCTION "public"."decline_split_expense"'));
    expect(chunk).toMatch(/UPDATE public\.split_expenses SET status = 'accepted' WHERE id = p_split_id AND status <> 'needs_attention'/);
  });

  it("decline_split_expense creates no transaction, and rejects declining an already-accepted participation", () => {
    const sql = readMigration(FILE);
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."decline_split_expense"');
    const chunk = sql.slice(start);
    expect(chunk).not.toMatch(/INSERT INTO public\.transactions/);
    expect(chunk).toMatch(/RAISE EXCEPTION 'This split expense was already accepted -- it cannot be declined afterward'/);
    expect(chunk).toMatch(/UPDATE public\.split_expenses SET status = 'needs_attention' WHERE id = p_split_id/);
  });
});

describe("20260921000300_delete_user_everything_split_cleanup.sql", () => {
  const FILE = "20260921000300_delete_user_everything_split_cleanup.sql";

  it("adds explicit Split Expenses cleanup for the deleted user across every relevant table/column", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/delete from split_generated_transactions where user_id = p_user_id;/);
    expect(sql).toMatch(/delete from split_settlements\s+where from_user_id = p_user_id or to_user_id = p_user_id;/);
    expect(sql).toMatch(/delete from split_item_allocations\s+where user_id = p_user_id;/);
    expect(sql).toMatch(/delete from split_receipts\s+where payer_user_id = p_user_id;/);
    expect(sql).toMatch(/delete from split_participants\s+where user_id = p_user_id;/);
    expect(sql).toMatch(/delete from split_expenses\s+where created_by = p_user_id;/);
  });

  it("keeps the existing service_role-only guard and every pre-existing cleanup line unchanged", () => {
    const sql = readMigration(FILE);
    expect(sql).toMatch(/if auth\.role\(\) is distinct from 'service_role' then/);
    expect(sql).toMatch(/delete from friend_requests\s+where sender_id = p_user_id or recipient_id = p_user_id;/);
    expect(sql).toMatch(/delete from notifications\s+where user_id = p_user_id;/);
    expect(sql).toMatch(/delete from transactions where user_id = p_user_id;/);
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
