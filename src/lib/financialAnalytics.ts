import type { TransactionWithCat } from "./transactions";
import { type MonthRange, isExpenseTx, isTransactionInRange, sumTransactionAmounts } from "./financialPeriods";

/**
 * Category/rate math still computed client-side against an already-scoped
 * transaction set (e.g. the Transactions page's active date filter --
 * see src/lib/transactionsAnalytics.ts). As of Backend Part 4, the
 * Dashboard/Reports/Budgets period totals and multi-month bucket math this
 * module used to provide are computed server-side instead (see
 * dashboard_summary()/reports_summary() in
 * supabase/migrations/20260915000000_financial_aggregate_functions.sql
 * and docs/BACKEND_AUDIT_REPORT.md Backend Part 4) — the raw-transaction
 * versions of that math were removed here since fetching a user's entire
 * history into the browser to compute them is exactly the row-cap
 * exposure that Part fixed.
 */

export type PeriodTotals = { income: number; expenses: number; net: number };
export type MonthlyBucket = { month: string; income: number; expenses: number };

export type CategoryAmount = {
  id: number;
  label: string;
  amount: number;
  /** Number of expense transactions in this category within the range. */
  count: number;
  /** Share of the range's total expenses, 0-100. 0 when there are no expenses in the range. */
  percent: number;
};

/**
 * Real expense transactions in `range`, grouped by category. Income
 * transactions are never counted as spending. Sorted by amount descending,
 * with category name as a deterministic tie-break so equal amounts always
 * render in the same order.
 */
export function expenseCategoryTotals(
  transactions: TransactionWithCat[],
  range: MonthRange,
  options: { topN?: number; categoryName?: string } = {}
): CategoryAmount[] {
  const inRange = transactions.filter((tx) => isTransactionInRange(tx, range) && isExpenseTx(tx));
  const filtered =
    options.categoryName && options.categoryName !== "All Categories"
      ? inRange.filter((tx) => (tx.categories?.name ?? "Uncategorized") === options.categoryName)
      : inRange;

  const totalExpenses = sumTransactionAmounts(inRange);

  const grouped = new Map<number, { label: string; amount: number; count: number }>();
  for (const tx of filtered) {
    const id = tx.category_id ?? -1;
    const label = tx.categories?.name ?? "Uncategorized";
    const entry = grouped.get(id);
    if (entry) {
      entry.amount += Number(tx.amount);
      entry.count += 1;
    } else {
      grouped.set(id, { label, amount: Number(tx.amount), count: 1 });
    }
  }

  const results: CategoryAmount[] = Array.from(grouped.entries()).map(([id, { label, amount, count }]) => ({
    id,
    label,
    amount,
    count,
    percent: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
  }));

  results.sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));

  return options.topN ? results.slice(0, options.topN) : results;
}

/** (income - expenses) / income * 100, or null when income is 0 (no truthful rate to report). */
export function savingsRate(income: number, expenses: number): number | null {
  if (income <= 0) return null;
  return ((income - expenses) / income) * 100;
}

/** Percent change from `previous` to `current`, or null when `previous` is 0 (no truthful baseline to compare against). */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
