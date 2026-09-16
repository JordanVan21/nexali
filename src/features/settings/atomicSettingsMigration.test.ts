import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Real SQL integration testing (spinning up Postgres, calling the RPC, and
 * asserting a partial-failure rolls back) is not available in this
 * repository's test environment -- there is no local/CI Postgres instance
 * wired to Vitest. This suite is the documented alternative the task asks
 * for: statically verify the migration file itself defines ONE PostgreSQL
 * function containing both the profiles UPDATE and the
 * notification_preferences write, with no explicit exception handler that
 * would let one half's failure be swallowed and the other half still
 * commit -- i.e. that the fix genuinely relies on Postgres's own normal
 * whole-function transaction/rollback semantics rather than reimplementing
 * (and potentially getting wrong) its own partial-commit logic.
 */
const MIGRATION_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/20260918000200_atomic_settings_update.sql"
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

describe("update_user_settings migration (static verification, Backend Part 7 atomicity fix)", () => {
  it("defines exactly one update_user_settings function", () => {
    const sql = readMigration();
    const matches = sql.match(/CREATE OR REPLACE FUNCTION "public"\."update_user_settings"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("is SECURITY INVOKER, not SECURITY DEFINER", () => {
    const sql = readMigration();
    expect(sql).toMatch(/SECURITY INVOKER/);
    expect(sql).not.toMatch(/SECURITY DEFINER/);
  });

  it("derives the user from auth.uid() and never accepts a p_user_id parameter", () => {
    const sql = readMigration();
    expect(sql).toMatch(/auth\.uid\(\)/);

    // Scope the "no p_user_id" check to the function's own parameter list
    // (between its name and its RETURNS clause) -- the migration's prose
    // comments legitimately mention "p_user_id" while explaining that it
    // does NOT exist as a parameter here, so a whole-file substring check
    // would false-positive on those comments.
    const signatureStart = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."update_user_settings"(');
    const signatureEnd = sql.indexOf(") RETURNS", signatureStart);
    const signature = sql.slice(signatureStart, signatureEnd);
    expect(signature).not.toMatch(/p_user_id/);
  });

  it("fails safely (RAISE EXCEPTION) when auth.uid() is null, rather than silently no-op-ing", () => {
    const sql = readMigration();
    expect(sql).toMatch(/IF v_uid IS NULL THEN\s*\n\s*RAISE EXCEPTION/);
  });

  it("updates public.profiles with exactly the four real Settings columns, scoped to the caller's own row", () => {
    const sql = readMigration();
    expect(sql).toMatch(/UPDATE public\.profiles/);
    expect(sql).toMatch(/"timezone"\s*=\s*p_timezone/);
    expect(sql).toMatch(/"currency"\s*=\s*p_currency/);
    expect(sql).toMatch(/"date_format"\s*=\s*p_date_format/);
    expect(sql).toMatch(/"number_format"\s*=\s*p_number_format/);
    expect(sql).toMatch(/WHERE\s+"id"\s*=\s*v_uid/);
  });

  it("does not touch unrelated Profile identity fields", () => {
    const sql = readMigration();
    // Scope the check to the function body's profiles UPDATE statement only.
    const updateStatement = sql.slice(sql.indexOf("UPDATE public.profiles"), sql.indexOf("IF NOT FOUND"));
    expect(updateStatement).not.toMatch(/"phone"/);
    expect(updateStatement).not.toMatch(/"location"/);
    expect(updateStatement).not.toMatch(/"financial_bio"/);
    expect(updateStatement).not.toMatch(/"full_name"/);
    expect(updateStatement).not.toMatch(/"avatar_url"/);
    expect(updateStatement).not.toMatch(/"budget_reset_cycle"/);
    expect(updateStatement).not.toMatch(/"reset_day"/);
  });

  it("upserts public.notification_preferences with exactly the four real preference columns, scoped to the caller's own row", () => {
    const sql = readMigration();
    expect(sql).toMatch(/INSERT INTO public\.notification_preferences/);
    expect(sql).toMatch(/VALUES \(v_uid, p_budget_approaching, p_budget_exceeded, p_monthly_summary, p_account_security\)/);
    expect(sql).toMatch(/ON CONFLICT \("user_id"\) DO UPDATE/);
  });

  it("both writes live inside the SAME function body (between its CREATE and its closing $$), relying on one implicit transaction", () => {
    const sql = readMigration();
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."update_user_settings"');
    const bodyEnd = sql.indexOf("END;\n$$;", start);
    expect(start).toBeGreaterThan(-1);
    expect(bodyEnd).toBeGreaterThan(start);

    const body = sql.slice(start, bodyEnd);
    expect(body).toMatch(/UPDATE public\.profiles/);
    expect(body).toMatch(/INSERT INTO public\.notification_preferences/);
  });

  it("contains no exception handler that would catch and swallow one write's failure so the other could still commit", () => {
    const sql = readMigration();
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."update_user_settings"');
    const bodyEnd = sql.indexOf("END;\n$$;", start);
    const body = sql.slice(start, bodyEnd);

    // No "EXCEPTION WHEN ... THEN" block inside this function -- a real
    // Postgres EXCEPTION clause establishes a sub-transaction/savepoint
    // that WOULD let a caught failure be silently continued past, which is
    // exactly the partial-commit bug this migration exists to prevent.
    expect(body).not.toMatch(/EXCEPTION\s+WHEN/i);
  });

  it("validates every enum-like preference value before writing (real CHECK-matching validation, not client-trust-only)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/is_valid_tz\(p_timezone\)/);
    expect(sql).toMatch(/p_currency\s*<>\s*ALL/);
    expect(sql).toMatch(/p_date_format\s*<>\s*ALL/);
    expect(sql).toMatch(/p_number_format\s*<>\s*ALL/);
  });

  it("revokes PUBLIC execute and grants only to authenticated (no anon)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION "public"\."update_user_settings"[\s\S]*?FROM PUBLIC/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION "public"\."update_user_settings"[\s\S]*?TO "authenticated"/);
    expect(sql).not.toMatch(/GRANT[\s\S]*?update_user_settings[\s\S]*?TO "anon"/);
  });
});
