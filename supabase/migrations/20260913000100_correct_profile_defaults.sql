-- Backend Part 2 — P1 fix.
--
-- profiles.budget_reset_cycle defaults to the literal string 'month', but
-- the real frontend <Select> (Profile page) only ever writes/recognizes
-- 'weekly' | 'monthly' | 'quarterly' | 'yearly'. handle_new_user() does not
-- set this column explicitly, so every newly-signed-up user's profile row
-- takes the column default -- meaning every new signup gets a value the
-- Profile dropdown does not match against any option, until the user
-- happens to open Profile and re-save it once.
--
-- Fix the default for all future rows.
ALTER TABLE "public"."profiles"
  ALTER COLUMN "budget_reset_cycle" SET DEFAULT 'monthly';

-- Existing-row backfill, narrowly scoped: 'month' is not a value the
-- frontend has ever offered as a choice (the <Select> options are
-- weekly/monthly/quarterly/yearly), so any row that currently holds the
-- literal value 'month' can only have gotten there via the unfixed
-- database default -- it is not, and never was, a real user selection.
-- This UPDATE therefore corrects a broken default's leftover value rather
-- than overwriting a genuine user choice. It touches no other column and
-- no row where the user has ever actually chosen a cycle.
UPDATE "public"."profiles"
  SET "budget_reset_cycle" = 'monthly'
  WHERE "budget_reset_cycle" = 'month';
