-- Backend Part 3 -- transaction date architecture.
--
-- transactions.created_at has been doing double duty as both the technical
-- row-creation timestamp AND the transaction's financial date, which is
-- wrong: a purchase entered today that actually happened last week should
-- be counted against last week, not today. This migration adds a real
-- financial-date column, occurred_at, and leaves created_at exactly as it
-- is (still a technical/audit timestamp -- see docs/BACKEND_AUDIT_REPORT.md
-- §5/P1-3).
--
-- Type: timestamptz, matching the existing transactions.created_at column
-- (timestamp WITH time zone) so financial-date math continues to operate
-- on real absolute instants rather than losing zone information.
--
-- Nullability: added nullable first so the backfill below can run, then
-- set NOT NULL once every existing row has a real value -- every
-- transaction must have a financial date.
ALTER TABLE "public"."transactions"
  ADD COLUMN "occurred_at" timestamp with time zone;

-- Historical backfill. No separate financial date has ever existed before
-- this migration, so created_at (the row's insert time) is the only
-- defensible fallback for existing rows -- it cannot recover a user's true
-- original purchase date, but it is the best available value and is
-- exactly what the app has been treating as the transaction date all
-- along, so this backfill changes no user-visible behavior for historical
-- rows. created_at itself is never modified.
UPDATE "public"."transactions"
  SET "occurred_at" = "created_at"
  WHERE "occurred_at" IS NULL;

ALTER TABLE "public"."transactions"
  ALTER COLUMN "occurred_at" SET NOT NULL;

-- No DEFAULT is set. Every insert path in the application now explicitly
-- supplies occurred_at (the user's chosen or defaulted transaction date --
-- see src/lib/transactions.ts upsertTransaction and
-- src/components/TransactionForm.tsx), so an insert that omits it should
-- fail loudly (NOT NULL violation) rather than silently and implicitly
-- becoming "now" and masking a real application bug.

-- Common access pattern is "this user's transactions, most-recent-financial-
-- date first" (Transactions page default sort, and the date range filter),
-- which is now occurred_at rather than created_at -- see
-- docs/BACKEND_AUDIT_REPORT.md §24 for the original (superseded)
-- created_at-based index recommendation.
CREATE INDEX IF NOT EXISTS "transactions_user_id_occurred_at_idx"
  ON "public"."transactions" USING "btree" ("user_id", "occurred_at" DESC);
