import { supabase } from "../supabaseClient";

/**
 * Typed wrappers around the server-side financial aggregate RPCs
 * (supabase/migrations/20260915000000_financial_aggregate_functions.sql).
 * Every function here derives the caller's identity from auth.uid() on the
 * server -- none of these RPCs takes a user id argument, so there is
 * nothing here to authorize other than "the caller is signed in," which
 * Supabase's own client already guarantees for every request.
 */

export type MonthTotals = { income: number; expenses: number; net: number };
export type PeriodTotals = { income: number; expenses: number; net: number };
export type CashflowBucket = { year: number; month: number; income: number; expenses: number };
export type CategoryBreakdownEntry = { id: number; label: string; amount: number; percent: number };
export type CategoryTotalEntry = { id: number; label: string; amount: number; count: number; percent: number };
export type RecentTransactionEntry = {
  id: number;
  amount: number;
  merchant: string | null;
  note: string | null;
  created_at: string | null;
  /** transactions.occurred_at is NOT NULL (see Backend Part 3's migration). */
  occurred_at: string;
  category_id: number | null;
  categories: { id: number; name: string; type: "income" | "expense" } | null;
};
export type BudgetRangeSpend = { categoryId: number; year: number; month: number; spent: number };

export type DashboardSummaryResponse = {
  month: MonthTotals;
  prevMonth: { income: number; expenses: number };
  cashflow: CashflowBucket[];
  categoryBreakdown: CategoryBreakdownEntry[];
  recentTransactions: RecentTransactionEntry[];
  /** The local calendar month (in the caller's configured timezone) that `month`/`categoryBreakdown` used -- pass straight through to budgets_progress() for a consistent "current period" budget snapshot. */
  currentYear: number;
  currentMonth: number;
};

export type ReportsSummaryResponse = {
  totals: PeriodTotals;
  previousTotals: PeriodTotals;
  monthlyBuckets: CashflowBucket[];
  categoryTotals: CategoryTotalEntry[];
  previousCategoryTotals: CategoryTotalEntry[];
  categoryNames: string[];
  budgetsInRange: BudgetRangeSpend[];
  /** The exact half-open [rangeStart, rangeEnd) instant bounds the server used -- reuse these for a bounded CSV export query instead of recomputing the range client-side. */
  rangeStart: string;
  rangeEnd: string;
  /** True iff the user has ever recorded any transaction, independent of the selected period -- distinguishes "brand new user" from "no activity in this particular window". */
  hasAnyTransactionsEver: boolean;
};

export type BudgetsProgressRow = { categoryId: number; spent: number };

function n(value: unknown): number {
  return Number(value ?? 0);
}

function toRecentTransaction(raw: unknown): RecentTransactionEntry {
  const row = raw as Record<string, unknown>;
  const cat = row.categories as Record<string, unknown> | null;
  return {
    id: Number(row.id),
    amount: n(row.amount),
    merchant: (row.merchant as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    occurred_at: row.occurred_at as string,
    category_id: row.category_id == null ? null : Number(row.category_id),
    categories: cat ? { id: Number(cat.id), name: String(cat.name), type: cat.type as "income" | "expense" } : null,
  };
}

/** Real, server-computed Dashboard data for the caller's current calendar month, in their configured timezone. */
export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  const { data, error } = await supabase.rpc("dashboard_summary");
  if (error) throw error;

  const raw = (data ?? {}) as Record<string, unknown>;
  const month = (raw.month ?? {}) as Record<string, unknown>;
  const prevMonth = (raw.prevMonth ?? {}) as Record<string, unknown>;
  const cashflow = (raw.cashflow as unknown[]) ?? [];
  const categoryBreakdown = (raw.categoryBreakdown as unknown[]) ?? [];
  const recentTransactions = (raw.recentTransactions as unknown[]) ?? [];

  return {
    month: { income: n(month.income), expenses: n(month.expenses), net: n(month.net) },
    prevMonth: { income: n(prevMonth.income), expenses: n(prevMonth.expenses) },
    cashflow: cashflow.map((b) => {
      const row = b as Record<string, unknown>;
      return { year: Number(row.year), month: Number(row.month), income: n(row.income), expenses: n(row.expenses) };
    }),
    categoryBreakdown: categoryBreakdown.map((c) => {
      const row = c as Record<string, unknown>;
      return { id: Number(row.id), label: String(row.label), amount: n(row.amount), percent: n(row.percent) };
    }),
    recentTransactions: recentTransactions.map(toRecentTransaction),
    currentYear: Number(raw.currentYear),
    currentMonth: Number(raw.currentMonth),
  };
}

/** Real, server-computed Reports data for an N-month window ending in the caller's current local month. */
export async function getReportsSummary(monthsCount: number, categoryName?: string): Promise<ReportsSummaryResponse> {
  const { data, error } = await supabase.rpc("reports_summary", {
    p_months_count: monthsCount,
    p_category_name: categoryName ?? null,
  });
  if (error) throw error;

  const raw = (data ?? {}) as Record<string, unknown>;
  const totals = (raw.totals ?? {}) as Record<string, unknown>;
  const previousTotals = (raw.previousTotals ?? {}) as Record<string, unknown>;
  const monthlyBuckets = (raw.monthlyBuckets as unknown[]) ?? [];
  const categoryTotals = (raw.categoryTotals as unknown[]) ?? [];
  const previousCategoryTotals = (raw.previousCategoryTotals as unknown[]) ?? [];
  const categoryNames = (raw.categoryNames as unknown[]) ?? [];
  const budgetsInRange = (raw.budgetsInRange as unknown[]) ?? [];

  const toCategoryTotal = (c: unknown): CategoryTotalEntry => {
    const row = c as Record<string, unknown>;
    return {
      id: Number(row.id),
      label: String(row.label),
      amount: n(row.amount),
      count: Number(row.count ?? 0),
      percent: n(row.percent),
    };
  };

  return {
    totals: { income: n(totals.income), expenses: n(totals.expenses), net: n(totals.net) },
    previousTotals: { income: n(previousTotals.income), expenses: n(previousTotals.expenses), net: n(previousTotals.net) },
    monthlyBuckets: monthlyBuckets.map((b) => {
      const row = b as Record<string, unknown>;
      return { year: Number(row.year), month: Number(row.month), income: n(row.income), expenses: n(row.expenses) };
    }),
    categoryTotals: categoryTotals.map(toCategoryTotal),
    previousCategoryTotals: previousCategoryTotals.map(toCategoryTotal),
    categoryNames: categoryNames.map((c) => String(c)),
    budgetsInRange: budgetsInRange.map((b) => {
      const row = b as Record<string, unknown>;
      return { categoryId: Number(row.categoryId), year: Number(row.year), month: Number(row.month), spent: n(row.spent) };
    }),
    rangeStart: String(raw.rangeStart),
    rangeEnd: String(raw.rangeEnd),
    hasAnyTransactionsEver: Boolean(raw.hasAnyTransactionsEver),
  };
}

/** Real expense spend per category for one budget period (year/month), in a single grouped query -- never one request per budget. */
export async function getBudgetsProgress(year: number, month: number): Promise<BudgetsProgressRow[]> {
  const { data, error } = await supabase.rpc("budgets_progress", { p_year: year, p_month: month });
  if (error) throw error;
  return (data ?? []).map((row) => ({ categoryId: Number(row.category_id), spent: n(row.spent) }));
}
