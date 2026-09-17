import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Static verification of the 2026-09-20 corrective migration
 * (20260920000000_fix_friends_email_type_cast.sql), the same documented
 * alternative used by ../../../supabase/migrations's other Friends
 * migration tests: there is no local/CI Postgres wired to Vitest.
 *
 * Root cause (proven live, via a rolled-back transaction against the
 * linked project -- see the Friends-connectivity-bug final report): both
 * list_friends() and search_nexali_users() SELECT auth.users.email
 * directly into a RETURNS TABLE column declared `email text`. But
 * auth.users.email is `character varying(255)`, not `text` -- confirmed
 * via information_schema.columns -- and PL/pgSQL's RETURN QUERY
 * type-checks the query's output tuple descriptor against the declared
 * return type before producing any rows, so this raised
 * `42804: structure of query does not match function result type` on
 * EVERY call, including for a user with zero friendships/zero matches
 * (not a row-count-dependent failure). This was reproduced live for both
 * functions before being fixed here with a minimal `::text` cast on the
 * two `u.email` references that feed that column -- no other behavior,
 * validation, security, RLS, or grant change.
 */
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../supabase/migrations");
const FILE = "20260920000000_fix_friends_email_type_cast.sql";

function readMigration(): string {
  return readFileSync(path.join(MIGRATIONS_DIR, FILE), "utf8");
}

describe("20260920000000_fix_friends_email_type_cast.sql (list_friends/search_nexali_users email varchar->text fix)", () => {
  it("casts auth.users.email to ::text in list_friends() so its output matches the declared `email text` column", () => {
    const sql = readMigration();
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."list_friends"');
    const end = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."search_nexali_users"');
    const body = sql.slice(start, end);
    expect(body).toMatch(/u\.email::text/);
    // The old, broken form (bare u.email in the SELECT list) must be gone.
    expect(body).not.toMatch(/^\s*u\.email,\s*$/m);
  });

  it("casts auth.users.email to ::text inside search_nexali_users()'s privacy CASE expression", () => {
    const sql = readMigration();
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."search_nexali_users"');
    const body = sql.slice(start);
    expect(body).toMatch(/CASE WHEN lower\(trim\(u\.email\)\) = v_query THEN u\.email::text ELSE NULL END/);
  });

  it("does not touch any other column: user_id/full_name/avatar_url/friendship_id/friends_since/relationship_status are untouched", () => {
    const sql = readMigration();
    expect(sql).toMatch(/RETURNS TABLE\("user_id" "uuid", "full_name" "text", "avatar_url" "text", "email" "text", "friendship_id" "uuid", "friends_since" timestamp with time zone\)/);
    expect(sql).toMatch(/RETURNS TABLE\("user_id" "uuid", "full_name" "text", "avatar_url" "text", "email" "text", "relationship_status" "text"\)/);
  });

  it("preserves the email-privacy guarantee exactly: only an exact trimmed/lowercased match reveals email, everything else stays NULL", () => {
    const sql = readMigration();
    // The privacy condition itself (the WHEN clause) must be byte-identical
    // to the original migration -- only the THEN branch gained a cast.
    expect(sql).toMatch(/WHEN lower\(trim\(u\.email\)\) = v_query THEN/);
    expect(sql).toMatch(/ELSE NULL END/);
  });

  it("preserves wildcard-injection-safe name matching (strpos, never ILIKE)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/strpos\(lower\(coalesce\(p\.full_name, ''\)\), v_query\) > 0/);
    expect(sql).not.toMatch(/ILIKE/);
  });

  it("preserves the 2-character minimum and LIMIT 20 search bounds", () => {
    const sql = readMigration();
    expect(sql).toMatch(/IF length\(v_query\) < 2 THEN\s*\n\s*RETURN;/);
    expect(sql).toMatch(/LIMIT 20/);
  });

  it("preserves self-exclusion via auth.uid(), never a client-supplied id", () => {
    const sql = readMigration();
    expect(sql).toMatch(/WHERE p\.id <> v_uid/);
  });

  it("preserves both functions' identity/security discipline: auth.uid()-only, null-rejected, SECURITY DEFINER, pinned search_path", () => {
    const sql = readMigration();
    for (const name of ["list_friends", "search_nexali_users"]) {
      const start = sql.indexOf(`CREATE OR REPLACE FUNCTION "public"."${name}"`);
      const nextMarker = sql.indexOf('CREATE OR REPLACE FUNCTION "public"."', start + 1);
      const chunk = nextMarker === -1 ? sql.slice(start) : sql.slice(start, nextMarker);
      expect(chunk, `${name} should be SECURITY DEFINER`).toMatch(/SECURITY DEFINER/);
      expect(chunk, `${name} should pin search_path`).toMatch(/SET "search_path" TO 'public', 'pg_temp'/);
      expect(chunk, `${name} should derive identity from auth.uid()`).toMatch(/auth\.uid\(\)/);
      expect(chunk, `${name} should reject a null caller`).toMatch(/RAISE EXCEPTION '.*requires an authenticated user'/);
    }
  });

  it("preserves REVOKE-then-GRANT-to-authenticated-only on both functions (no anon grant)", () => {
    const sql = readMigration();
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION "public"\."list_friends"\(\) FROM PUBLIC/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION "public"\."list_friends"\(\) TO "authenticated"/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION "public"\."search_nexali_users"\("p_query" "text"\) FROM PUBLIC/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION "public"\."search_nexali_users"\("p_query" "text"\) TO "authenticated"/);
    expect(sql).not.toMatch(/TO "anon"/);
  });

  it("does not edit the already-deployed 20260919000200_friends_rpcs.sql -- this is a forward-only CREATE OR REPLACE migration", () => {
    const original = readFileSync(path.join(MIGRATIONS_DIR, "20260919000200_friends_rpcs.sql"), "utf8");
    // The original migration's un-cast form must remain exactly as deployed
    // -- proving this fix is a NEW file, not an edit of the historical one.
    expect(original).toMatch(/CASE WHEN lower\(trim\(u\.email\)\) = v_query THEN u\.email ELSE NULL END/);
    expect(original).not.toMatch(/u\.email::text/);
  });

  it("does not create a duplicate friend_requests/friendships table or alter any RLS/grant on them", () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/CREATE TABLE/);
    expect(sql).not.toMatch(/ALTER TABLE/);
    expect(sql).not.toMatch(/ROW LEVEL SECURITY/);
  });
});
