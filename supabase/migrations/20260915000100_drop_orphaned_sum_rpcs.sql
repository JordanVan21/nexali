-- Backend Part 4: remove the three all-time "sum" RPCs now that the
-- server-side aggregate functions in 20260915000000 fully replace their
-- purpose with period-correct, timezone-aware figures.
--
-- Verified before dropping (see docs/BACKEND_AUDIT_REPORT.md Backend
-- Part 4): the only application code that ever called these was
-- src/features/dashboard/useTotals.ts, src/features/budgets/useSpentAmount.ts,
-- and getSpentAmount() in src/lib/budgets.ts -- none of which were reachable
-- from any page or component (dead code, confirmed by a repo-wide grep for
-- their call sites). All three are removed from the frontend in this same
-- Part, alongside this migration.
--
-- Also worth recording: these three functions were GRANTed to `anon` in
-- the original baseline schema (20260910235021_remote_schema.sql), and
-- each accepts an arbitrary `uid`/`cat_id` argument with no ownership
-- check against the caller's own identity -- meaning an unauthenticated
-- caller could already have queried any user's all-time income, expense,
-- or per-category total by guessing/enumerating a UUID. Dropping them
-- removes this exposure entirely, on top of removing the all-time-only
-- correctness problem they also had (see docs/AUDIT_REPORT.md P1/P2 for
-- the original finding).
DROP FUNCTION IF EXISTS public.sum_income_amount(uuid);
DROP FUNCTION IF EXISTS public.sum_expense_amount(uuid);
DROP FUNCTION IF EXISTS public.sum_category_amount(uuid, integer);
