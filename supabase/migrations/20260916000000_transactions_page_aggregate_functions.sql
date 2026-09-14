-- Backend Part 5: server-side aggregates for the Transactions page's two
-- remaining unbounded fetchTransactions/useTransactions consumers --
-- TransactionFilterBar's category-count badges and TransactionAnalytics'
-- "Average Daily Burn"/"Top Categories" cards (see
-- docs/BACKEND_AUDIT_REPORT.md Backend Part 4 §36.3/§36.13 for the
-- consumer trace that identified these as the last two).
--
-- Same conventions as Backend Part 4's
-- 20260915000000_financial_aggregate_functions.sql:
--   * SECURITY INVOKER -- RLS (already scoped to auth.uid()) is what
--     actually restricts the data; neither function bypasses it.
--   * auth.uid()-derived ownership only -- no p_user_id parameter.
--   * profiles.timezone-derived period boundaries -- no client-supplied
--     timezone is trusted for financial classification.
--   * half-open [start, end) ranges.
--   * search_path pinned; authenticated-only EXECUTE grants, revoked from
--     PUBLIC/anon.
--   * safe, empty-but-well-typed results when auth.uid() is null.

-- ============================================================================
-- transaction_category_counts(): all-time transaction count per category,
-- for the Transactions page's category-filter dropdown badges.
--
-- Semantics (preserved exactly from the removed client-side
-- useTransactionCounts()): an ALL-TIME tally, independent of every other
-- active filter (date range, search, type, amount, and the category filter
-- itself) -- this was confirmed by re-reading the pre-existing
-- implementation (src/lib/transactions.ts's useTransactionCounts reduced
-- the entire unbounded useTransactions(userId) result with zero filter
-- arguments applied at all) before writing this function, per instruction
-- not to assume a different (e.g. filter-reactive/faceted-search) meaning.
-- Grouped by category NAME (not id), matching the original's `Record<name,
-- count>` keying exactly, including merging two categories that happen to
-- share a name, and counting a transaction with no category under the
-- literal key "Uncategorized".
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transaction_category_counts()
RETURNS TABLE(category_name text, count bigint)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(c.name, 'Uncategorized') AS category_name, COUNT(*) AS count
  FROM public.transactions t
  LEFT JOIN public.categories c ON c.id = t.category_id
  -- No explicit auth.uid() IS NULL guard needed: an unauthenticated caller
  -- has auth.uid() = NULL, and `t.user_id = NULL` is never true for any
  -- row, so this naturally returns an empty set (on top of RLS already
  -- enforcing the same restriction).
  WHERE t.user_id = auth.uid()
  GROUP BY COALESCE(c.name, 'Uncategorized');
$$;

REVOKE ALL ON FUNCTION public.transaction_category_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transaction_category_counts() TO authenticated;

-- ============================================================================
-- transactions_activity_summary(p_from, p_to): the Transactions page's
-- "Average Daily Burn" and "Top Categories" cards, server-computed.
--
-- p_from/p_to (both required together, or both omitted) are the ALREADY
-- timezone-correct half-open instant bounds TransactionFilterBar computes
-- for its active date-range filter (see startOfDayIso/startOfNextDayIso in
-- TransactionFilterBar.tsx, established in Backend Part 4) -- passing an
-- absolute instant is not "trusting a client-supplied timezone" the way
-- passing an IANA zone string would be; the instant is unambiguous
-- regardless of who computed it. Period CLASSIFICATION (which calendar day
-- an instant falls on) still always uses the server's own
-- profiles.timezone lookup, never a client-supplied zone.
--
-- When p_from/p_to are omitted (no active date filter), the period
-- defaults to "this calendar month, through today" in the caller's
-- CONFIGURED timezone -- replacing the previous client-side
-- resolveBurnPeriod()'s use of the browser's local Date, which is exactly
-- the residual browser-timezone gap flagged in Backend Part 4 §36.13.
--
-- Preserves the exact pre-existing product semantics of
-- src/lib/transactionsAnalytics.ts (verified by re-reading it before
-- writing this function):
--   * expense transactions only (income never counted as "burn").
--   * previous-period comparison: for a custom range, the immediately
--     preceding period of the SAME day-length; for month-to-date, the
--     FULL previous calendar month (not just "the same number of days
--     elapsed") -- a deliberate asymmetry in the original code, preserved
--     as-is rather than "fixed" into false consistency.
--   * previousDailyRate (and therefore changePercent) is null both when
--     there is no previous-period data AND when previous-period expense
--     was exactly zero -- the original code's isTruthfulBaseline
--     semantics (a $0 previous period is treated as "no baseline to
--     compare against", not a real baseline), preserved exactly rather
--     than "corrected".
--   * daily sparkline: real daily expense totals for up to the last 14
--     days of the period, oldest first, zero-filled for days with no
--     expenses.
--   * Top Categories: expense-only, fixed top-4, sorted by amount
--     descending with category-name tiebreak, percent computed against
--     the period's total expense (not the topN subset's own total).
--
-- Locale-aware LABEL formatting ("Sep 1 – Sep 15", "(month to date)") is
-- deliberately NOT computed here -- that is a presentation concern that
-- legitimately depends on the VIEWER's own locale (not a financial
-- classification concern), and stays client-side, built from the real
-- rangeStart/rangeEnd/isCustomRange this function returns -- the same
-- pattern Backend Part 4 used for Dashboard/Reports month labels.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transactions_activity_summary(p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tz text;
  v_now timestamptz := now();
  v_local_now timestamp;
  v_range_start timestamptz;
  v_range_end timestamptz;
  v_local_range_start timestamp;
  v_local_range_end timestamp;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_local_prev_start timestamp;
  v_days int;
  v_previous_days int;
  v_is_custom_range boolean;
  v_expense_amount numeric;
  v_previous_amount numeric;
  v_daily_rate numeric;
  v_previous_daily_rate numeric;
  v_change_percent numeric;
  v_bucket_days int;
  v_daily_buckets jsonb;
  v_top_categories jsonb;
BEGIN
  IF (p_from IS NULL) <> (p_to IS NULL) THEN
    RAISE EXCEPTION 'p_from and p_to must both be provided, or both omitted';
  END IF;
  IF p_from IS NOT NULL AND p_from >= p_to THEN
    RAISE EXCEPTION 'p_from must be before p_to';
  END IF;

  v_is_custom_range := p_from IS NOT NULL;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'rangeStart', COALESCE(p_from, v_now), 'rangeEnd', COALESCE(p_to, v_now),
      'previousRangeStart', v_now, 'previousRangeEnd', v_now,
      'days', 0, 'previousDays', 0, 'isCustomRange', v_is_custom_range,
      'expenseAmount', 0, 'dailyRate', 0, 'previousDailyRate', NULL, 'changePercent', NULL,
      'dailyBuckets', '[]'::jsonb, 'topCategories', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(p.timezone, 'UTC') INTO v_tz FROM public.profiles p WHERE p.id = v_uid;
  v_tz := COALESCE(v_tz, 'UTC');
  v_local_now := v_now AT TIME ZONE v_tz;

  IF v_is_custom_range THEN
    v_range_start := p_from;
    v_range_end := p_to;
    v_local_range_start := v_range_start AT TIME ZONE v_tz;
    v_local_range_end := v_range_end AT TIME ZONE v_tz;
    -- Calendar-day count between two already-day-aligned instants, computed
    -- on the NAIVE local representation so it can never be thrown off by a
    -- DST transition inside the range (unlike subtracting raw milliseconds
    -- and dividing by 86400000, which the removed client-side version did).
    v_days := GREATEST(1, (v_local_range_end)::date - (v_local_range_start)::date);
    v_local_prev_start := v_local_range_start - (v_days * interval '1 day');
    v_prev_start := v_local_prev_start AT TIME ZONE v_tz;
    v_prev_end := v_range_start;
    v_previous_days := v_days;
  ELSE
    -- Month to date, in the caller's configured timezone: from the 1st of
    -- the current local month through the end of today (inclusive).
    v_local_range_start := date_trunc('month', v_local_now);
    v_local_range_end := date_trunc('day', v_local_now) + interval '1 day';
    v_range_start := v_local_range_start AT TIME ZONE v_tz;
    v_range_end := v_local_range_end AT TIME ZONE v_tz;
    v_days := (v_local_range_end)::date - (v_local_range_start)::date;
    v_local_prev_start := v_local_range_start - interval '1 month';
    v_prev_start := v_local_prev_start AT TIME ZONE v_tz;
    v_prev_end := v_range_start;
    v_previous_days := (v_local_range_start)::date - (v_local_prev_start)::date;
  END IF;

  SELECT COALESCE(SUM(t.amount), 0) INTO v_expense_amount
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_range_start AND t.occurred_at < v_range_end;

  SELECT COALESCE(SUM(t.amount), 0) INTO v_previous_amount
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_prev_start AND t.occurred_at < v_prev_end;

  v_daily_rate := CASE WHEN v_days > 0 THEN v_expense_amount / v_days ELSE 0 END;
  -- NULL (not 0) when there is no truthful previous-period baseline --
  -- either no previous-period data at all, or the previous period's real
  -- expense total was exactly zero -- matching the original
  -- computeDailyBurn()'s semantics exactly.
  v_previous_daily_rate := CASE WHEN v_previous_days > 0 AND v_previous_amount > 0 THEN v_previous_amount / v_previous_days ELSE NULL END;
  v_change_percent := CASE WHEN v_previous_daily_rate IS NOT NULL THEN round((v_daily_rate - v_previous_daily_rate) / v_previous_daily_rate * 100, 4) ELSE NULL END;

  -- Daily sparkline: up to the last 14 real calendar days of the period,
  -- oldest first, zero-filled for a day with no expenses (never silently
  -- omitted) -- same generate_series LEFT JOIN zero-fill pattern as
  -- Backend Part 4's monthly buckets.
  v_bucket_days := LEAST(v_days, 14);
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'date', (gs.day_start AT TIME ZONE v_tz),
      'amount', COALESCE(agg.amount, 0)
    ) ORDER BY gs.day_start), '[]'::jsonb)
  INTO v_daily_buckets
  FROM generate_series(v_local_range_end - (v_bucket_days * interval '1 day'), v_local_range_end - interval '1 day', interval '1 day') AS gs(day_start)
  LEFT JOIN (
    SELECT date_trunc('day', t.occurred_at AT TIME ZONE v_tz) AS local_day, SUM(t.amount) AS amount
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_range_start AND t.occurred_at < v_range_end
    GROUP BY 1
  ) agg ON agg.local_day = gs.day_start;

  -- Top Categories: fixed top-4 (the UI has no variable topN control, so
  -- none is exposed here -- see "Function input validation" in the Part 5
  -- report), expense-only, percent against the period's real total expense.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', sub.id, 'label', sub.label, 'amount', sub.amount,
      'percent', CASE WHEN v_expense_amount > 0 THEN round(sub.amount / v_expense_amount * 100, 4) ELSE 0 END
    ) ORDER BY sub.amount DESC, sub.label ASC), '[]'::jsonb)
  INTO v_top_categories
  FROM (
    SELECT c.id, c.name AS label, SUM(t.amount) AS amount
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_range_start AND t.occurred_at < v_range_end
    GROUP BY c.id, c.name
    ORDER BY SUM(t.amount) DESC, c.name ASC
    LIMIT 4
  ) sub;

  RETURN jsonb_build_object(
    'rangeStart', v_range_start,
    'rangeEnd', v_range_end,
    'previousRangeStart', v_prev_start,
    'previousRangeEnd', v_prev_end,
    'days', v_days,
    'previousDays', v_previous_days,
    'isCustomRange', v_is_custom_range,
    'expenseAmount', v_expense_amount,
    'dailyRate', v_daily_rate,
    'previousDailyRate', v_previous_daily_rate,
    'changePercent', v_change_percent,
    'dailyBuckets', v_daily_buckets,
    'topCategories', v_top_categories
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transactions_activity_summary(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transactions_activity_summary(timestamptz, timestamptz) TO authenticated;
