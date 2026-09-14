-- Backend Part 4: timezone-correct, server-side financial aggregate
-- functions for the Dashboard, Reports, and Budgets pages.
--
-- Why this migration exists: Dashboard/Reports/Budgets previously computed
-- every "this month" / "this period" figure in the browser, against the
-- user's ENTIRE transaction history fetched with no server-side limit
-- (`fetchTransactions`). That is correct only as long as a single
-- unbounded PostgREST response can never be truncated -- which is not
-- guaranteed at any real transaction volume. It also never consulted
-- `profiles.timezone`, so period boundaries ("this month") were computed
-- in whatever timezone the user's BROWSER happened to be in, not their
-- configured financial timezone. See docs/BACKEND_AUDIT_REPORT.md Backend
-- Part 4 for the full analysis.
--
-- These functions fix both problems together: they run entirely in
-- Postgres (so a result set the size of a user's monthly/period summary is
-- returned, never their full history), and they derive the user's REAL
-- configured timezone from `profiles.timezone` (falling back to 'UTC' only
-- if a row is somehow missing it) rather than trusting anything the client
-- could pass in.
--
-- All three functions:
--   * are SECURITY INVOKER -- they run with the calling user's own
--     privileges, so the existing RLS policies on transactions/categories/
--     budgets/profiles (all scoped to auth.uid()) are what actually
--     restrict the data returned. No function here bypasses RLS.
--   * derive the caller's identity via auth.uid() only -- none accepts a
--     p_user_id (or similar) parameter, so a caller cannot request another
--     user's data by passing a different id.
--   * return a safe, empty-but-well-typed result (never an error, never
--     another user's data) when auth.uid() is null, as a defense-in-depth
--     measure on top of RLS already returning zero rows in that case.
--   * pin search_path to prevent search_path-hijacking, even though every
--     reference below is already schema-qualified.
--   * half-open period ranges ([start, end)), matching the convention
--     already established by src/lib/financialPeriods.ts's monthRange().
--
-- Financial precision: transactions.amount and budgets.amount are both
-- numeric(10,2). Every SUM()/arithmetic expression below stays in Postgres
-- `numeric` end to end; jsonb_build_object() serializes a numeric value as
-- a genuine JSON number (not a string), and supabase-js/PostgREST decode
-- that as a JS number on the client -- so no value here is ever routed
-- through a floating-point cast, and no client-side string-to-number
-- coercion is required for these RPC results specifically (the frontend
-- wrappers still defensively `Number(...)` them, consistent with how the
-- rest of the codebase already treats every other numeric() value coming
-- back from PostgREST).

-- ============================================================================
-- dashboard_summary(): Dashboard's month/prevMonth totals, 12-month
-- cashflow series, and top-4 current-month expense category breakdown, plus
-- a small bounded "recent activity" list. Budget progress is NOT part of
-- this function -- the Dashboard's budget snapshot reuses budgets_progress()
-- below (the same function the Budgets page itself uses), so a budgets-RPC
-- failure and a transactions-RPC failure remain two independent, separately
-- retryable error states in the UI, exactly as before this Part.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dashboard_summary()
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
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_local_month_start timestamp;
  v_month jsonb;
  v_prev_month jsonb;
  v_cashflow jsonb;
  v_category_breakdown jsonb;
  v_recent jsonb;
  v_total_month_expenses numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'month', jsonb_build_object('income', 0, 'expenses', 0, 'net', 0),
      'prevMonth', jsonb_build_object('income', 0, 'expenses', 0),
      'cashflow', '[]'::jsonb,
      'categoryBreakdown', '[]'::jsonb,
      'recentTransactions', '[]'::jsonb,
      'currentYear', extract(year FROM now())::int,
      'currentMonth', extract(month FROM now())::int
    );
  END IF;

  SELECT COALESCE(p.timezone, 'UTC') INTO v_tz FROM public.profiles p WHERE p.id = v_uid;
  v_tz := COALESCE(v_tz, 'UTC');

  v_month_start := date_trunc('month', v_now AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_month_end := v_month_start + interval '1 month';
  v_prev_start := v_month_start - interval '1 month';
  v_prev_end := v_month_start;
  v_local_month_start := v_month_start AT TIME ZONE v_tz;

  SELECT jsonb_build_object(
    'income', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'income'), 0),
    'expenses', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'expense'), 0),
    'net', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'income'), 0)
         - COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'expense'), 0)
  ) INTO v_month
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND t.occurred_at >= v_month_start AND t.occurred_at < v_month_end;

  SELECT jsonb_build_object(
    'income', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'income'), 0),
    'expenses', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'expense'), 0)
  ) INTO v_prev_month
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND t.occurred_at >= v_prev_start AND t.occurred_at < v_prev_end;

  -- 12-month cashflow series, zero-filled, oldest to newest. generate_series
  -- and the aggregate below both operate on naive local-wall-clock month
  -- starts so a month with zero transactions still produces a real bucket
  -- (COALESCEd to 0) instead of silently disappearing from the series.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'year', extract(year FROM gs.bucket_start)::int,
      'month', extract(month FROM gs.bucket_start)::int,
      'income', COALESCE(agg.income, 0),
      'expenses', COALESCE(agg.expenses, 0)
    ) ORDER BY gs.bucket_start), '[]'::jsonb)
  INTO v_cashflow
  FROM generate_series(v_local_month_start - interval '11 months', v_local_month_start, interval '1 month') AS gs(bucket_start)
  LEFT JOIN (
    SELECT
      date_trunc('month', t.occurred_at AT TIME ZONE v_tz) AS local_month,
      SUM(t.amount) FILTER (WHERE c.type = 'income') AS income,
      SUM(t.amount) FILTER (WHERE c.type = 'expense') AS expenses
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_uid
      AND t.occurred_at >= (v_local_month_start - interval '11 months') AT TIME ZONE v_tz
      AND t.occurred_at < v_month_end
    GROUP BY 1
  ) agg ON agg.local_month = gs.bucket_start;

  SELECT COALESCE(SUM(t.amount), 0) INTO v_total_month_expenses
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_month_start AND t.occurred_at < v_month_end;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', sub.id, 'label', sub.label, 'amount', sub.amount,
      'percent', CASE WHEN v_total_month_expenses > 0 THEN round(sub.amount / v_total_month_expenses * 100, 4) ELSE 0 END
    )), '[]'::jsonb)
  INTO v_category_breakdown
  FROM (
    SELECT c.id, c.name AS label, SUM(t.amount) AS amount
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_month_start AND t.occurred_at < v_month_end
    GROUP BY c.id, c.name
    ORDER BY SUM(t.amount) DESC, c.name ASC
    LIMIT 4
  ) sub;

  -- 5 most recent transactions overall (not restricted to this month),
  -- ordered by the real financial date (occurred_at), with a deterministic
  -- id tiebreak -- the same bounded-query approach as the Transactions
  -- page's server pagination (see transactions.ts), instead of fetching the
  -- user's entire history just to take the top 5.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', sub.id, 'amount', sub.amount, 'merchant', sub.merchant, 'note', sub.note,
      'created_at', sub.created_at, 'occurred_at', sub.occurred_at, 'category_id', sub.category_id,
      'categories', CASE WHEN sub.cat_id IS NOT NULL
        THEN jsonb_build_object('id', sub.cat_id, 'name', sub.cat_name, 'type', sub.cat_type)
        ELSE NULL END
    ) ORDER BY sub.occurred_at DESC, sub.id ASC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT t.id, t.amount, t.merchant, t.note, t.created_at, t.occurred_at, t.category_id,
           c.id AS cat_id, c.name AS cat_name, c.type AS cat_type
    FROM public.transactions t
    LEFT JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_uid
    ORDER BY t.occurred_at DESC, t.id ASC
    LIMIT 5
  ) sub;

  -- currentYear/currentMonth: the local calendar month this function just
  -- used for `month`/`categoryBreakdown`, in the user's configured
  -- timezone -- returned so the Dashboard's budget snapshot can call
  -- budgets_progress(year, month) for the SAME period without needing its
  -- own separate (and potentially inconsistent) notion of "now".
  RETURN jsonb_build_object(
    'month', v_month,
    'prevMonth', v_prev_month,
    'cashflow', v_cashflow,
    'categoryBreakdown', v_category_breakdown,
    'recentTransactions', v_recent,
    'currentYear', extract(year FROM v_local_month_start)::int,
    'currentMonth', extract(month FROM v_local_month_start)::int
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO authenticated;

-- ============================================================================
-- reports_summary(p_months_count, p_category_name): Reports page's totals,
-- previous-period comparison, zero-filled monthly buckets, expense category
-- breakdown (current + previous period, for the "vs previous period" per-
-- category comparison), the real distinct expense-category-name list for
-- the filter dropdown, and budget spend-per-category-per-month across the
-- whole range -- all in one request, matching the Reports page's own "load
-- everything for this period in one go" requirement (avoiding N+1 queries
-- across the page's several charts/tables).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reports_summary(p_months_count int, p_category_name text DEFAULT NULL)
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
  v_current_month_start timestamptz;
  v_range_start timestamptz;
  v_range_end timestamptz;
  v_prev_range_start timestamptz;
  v_prev_range_end timestamptz;
  v_local_range_start timestamp;
  v_totals jsonb;
  v_previous_totals jsonb;
  v_monthly_buckets jsonb;
  v_category_totals jsonb;
  v_previous_category_totals jsonb;
  v_category_names jsonb;
  v_budgets_in_range jsonb;
  v_total_range_expenses numeric;
  v_total_prev_expenses numeric;
  v_has_any_transactions boolean;
BEGIN
  IF p_months_count IS NULL OR p_months_count < 1 THEN
    RAISE EXCEPTION 'p_months_count must be a positive integer';
  END IF;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'totals', jsonb_build_object('income', 0, 'expenses', 0, 'net', 0),
      'previousTotals', jsonb_build_object('income', 0, 'expenses', 0, 'net', 0),
      'monthlyBuckets', '[]'::jsonb,
      'categoryTotals', '[]'::jsonb,
      'previousCategoryTotals', '[]'::jsonb,
      'categoryNames', '[]'::jsonb,
      'budgetsInRange', '[]'::jsonb,
      'rangeStart', now(),
      'rangeEnd', now(),
      'hasAnyTransactionsEver', false
    );
  END IF;

  SELECT COALESCE(p.timezone, 'UTC') INTO v_tz FROM public.profiles p WHERE p.id = v_uid;
  v_tz := COALESCE(v_tz, 'UTC');

  v_current_month_start := date_trunc('month', v_now AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_range_end := v_current_month_start + interval '1 month';
  v_range_start := v_current_month_start - (p_months_count - 1) * interval '1 month';
  v_prev_range_end := v_range_start;
  v_prev_range_start := v_range_start - p_months_count * interval '1 month';
  v_local_range_start := v_range_start AT TIME ZONE v_tz;

  SELECT jsonb_build_object(
    'income', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'income'), 0),
    'expenses', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'expense'), 0),
    'net', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'income'), 0)
         - COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'expense'), 0)
  ) INTO v_totals
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND t.occurred_at >= v_range_start AND t.occurred_at < v_range_end;

  SELECT jsonb_build_object(
    'income', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'income'), 0),
    'expenses', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'expense'), 0),
    'net', COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'income'), 0)
         - COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'expense'), 0)
  ) INTO v_previous_totals
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND t.occurred_at >= v_prev_range_start AND t.occurred_at < v_prev_range_end;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'year', extract(year FROM gs.bucket_start)::int,
      'month', extract(month FROM gs.bucket_start)::int,
      'income', COALESCE(agg.income, 0),
      'expenses', COALESCE(agg.expenses, 0)
    ) ORDER BY gs.bucket_start), '[]'::jsonb)
  INTO v_monthly_buckets
  FROM generate_series(v_local_range_start, v_local_range_start + (p_months_count - 1) * interval '1 month', interval '1 month') AS gs(bucket_start)
  LEFT JOIN (
    SELECT
      date_trunc('month', t.occurred_at AT TIME ZONE v_tz) AS local_month,
      SUM(t.amount) FILTER (WHERE c.type = 'income') AS income,
      SUM(t.amount) FILTER (WHERE c.type = 'expense') AS expenses
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_uid AND t.occurred_at >= v_range_start AND t.occurred_at < v_range_end
    GROUP BY 1
  ) agg ON agg.local_month = gs.bucket_start;

  SELECT COALESCE(SUM(t.amount), 0) INTO v_total_range_expenses
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_range_start AND t.occurred_at < v_range_end;

  SELECT COALESCE(SUM(t.amount), 0) INTO v_total_prev_expenses
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_prev_range_start AND t.occurred_at < v_prev_range_end;

  -- categoryTotals/previousCategoryTotals: p_category_name (when given)
  -- narrows which category ROWS are returned, but the percent denominator
  -- always stays the period's TOTAL expenses across every category -- this
  -- matches src/lib/financialAnalytics.ts's expenseCategoryTotals() exactly.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', sub.id, 'label', sub.label, 'amount', sub.amount, 'count', sub.cnt,
      'percent', CASE WHEN v_total_range_expenses > 0 THEN round(sub.amount / v_total_range_expenses * 100, 4) ELSE 0 END
    ) ORDER BY sub.amount DESC, sub.label ASC), '[]'::jsonb)
  INTO v_category_totals
  FROM (
    SELECT c.id, c.name AS label, SUM(t.amount) AS amount, COUNT(*) AS cnt
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_range_start AND t.occurred_at < v_range_end
      AND (p_category_name IS NULL OR p_category_name = 'All Categories' OR c.name = p_category_name)
    GROUP BY c.id, c.name
  ) sub;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', sub.id, 'label', sub.label, 'amount', sub.amount, 'count', sub.cnt,
      'percent', CASE WHEN v_total_prev_expenses > 0 THEN round(sub.amount / v_total_prev_expenses * 100, 4) ELSE 0 END
    ) ORDER BY sub.amount DESC, sub.label ASC), '[]'::jsonb)
  INTO v_previous_category_totals
  FROM (
    SELECT c.id, c.name AS label, SUM(t.amount) AS amount, COUNT(*) AS cnt
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_prev_range_start AND t.occurred_at < v_prev_range_end
      AND (p_category_name IS NULL OR p_category_name = 'All Categories' OR c.name = p_category_name)
    GROUP BY c.id, c.name
  ) sub;

  SELECT COALESCE(jsonb_agg(DISTINCT c.name ORDER BY c.name), '[]'::jsonb) INTO v_category_names
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND c.type = 'expense';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'categoryId', sub.category_id,
      'year', extract(year FROM sub.local_month)::int,
      'month', extract(month FROM sub.local_month)::int,
      'spent', sub.spent
    )), '[]'::jsonb)
  INTO v_budgets_in_range
  FROM (
    SELECT t.category_id, date_trunc('month', t.occurred_at AT TIME ZONE v_tz) AS local_month, SUM(t.amount) AS spent
    FROM public.transactions t
    JOIN public.categories c ON c.id = t.category_id
    WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_range_start AND t.occurred_at < v_range_end
    GROUP BY t.category_id, date_trunc('month', t.occurred_at AT TIME ZONE v_tz)
  ) sub;

  -- hasAnyTransactionsEver: a real all-time existence check (cheap -- an
  -- index-backed EXISTS, not a full scan), independent of the selected
  -- period -- lets the client tell "brand-new user, truly zero history"
  -- apart from "this user has history, just none in the selected window",
  -- which is a real product distinction (an empty state vs. real all-zero
  -- charts) the previous client-side implementation also preserved.
  SELECT EXISTS(SELECT 1 FROM public.transactions t WHERE t.user_id = v_uid) INTO v_has_any_transactions;

  -- rangeStart/rangeEnd: the exact half-open instant bounds this function
  -- used, so a client-side bounded export query (fetchAllTransactionsWithFilters)
  -- can reuse the IDENTICAL range instead of recomputing it independently
  -- and risking drift from the server's own timezone-aware computation.
  RETURN jsonb_build_object(
    'totals', v_totals,
    'previousTotals', v_previous_totals,
    'monthlyBuckets', v_monthly_buckets,
    'categoryTotals', v_category_totals,
    'previousCategoryTotals', v_previous_category_totals,
    'categoryNames', v_category_names,
    'budgetsInRange', v_budgets_in_range,
    'rangeStart', v_range_start,
    'rangeEnd', v_range_end,
    'hasAnyTransactionsEver', v_has_any_transactions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reports_summary(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reports_summary(int, text) TO authenticated;

-- ============================================================================
-- budgets_progress(p_year, p_month): real expense spend per category for
-- ONE budget period, in a single grouped query -- used by both the Budgets
-- page (useBudgetsForPeriod) and the Dashboard's budget snapshot, so a
-- budget list of any size is never resolved with one spend query per
-- budget (N+1). Budget row metadata (id, amount, category name) still
-- comes from the existing plain `budgets` table query (useBudgets) --
-- this function returns only the real-time spend figure per category,
-- which the client joins against the already-loaded budget list.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.budgets_progress(p_year int, p_month int)
RETURNS TABLE(category_id int, spent numeric)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  IF p_month IS NULL OR p_month < 1 OR p_month > 12 OR p_year IS NULL THEN
    RAISE EXCEPTION 'p_year/p_month must describe a real calendar month';
  END IF;

  SELECT COALESCE(p.timezone, 'UTC') INTO v_tz FROM public.profiles p WHERE p.id = v_uid;
  v_tz := COALESCE(v_tz, 'UTC');

  v_start := make_timestamp(p_year, p_month, 1, 0, 0, 0) AT TIME ZONE v_tz;
  v_end := v_start + interval '1 month';

  RETURN QUERY
  SELECT t.category_id, SUM(t.amount)
  FROM public.transactions t
  JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = v_uid AND c.type = 'expense' AND t.occurred_at >= v_start AND t.occurred_at < v_end
  GROUP BY t.category_id;
END;
$$;

REVOKE ALL ON FUNCTION public.budgets_progress(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.budgets_progress(int, int) TO authenticated;
