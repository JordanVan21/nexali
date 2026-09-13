import type { TransactionWithCat } from "./transactions";
import {
  type MonthRange,
  monthRange,
  isIncomeTx,
  isExpenseTx,
  isTransactionInRange,
  sumTransactionAmounts,
} from "./financialPeriods";

/**
 * Multi-month reporting math shared by the Dashboard (single current month)
 * and Reports (arbitrary N-month windows) — built on the same primitives
 * in financialPeriods.ts so every feature computes "income in a period" or
 * "expenses in a period" identically. Everything here operates on
 * already-loaded transactions; see docs/AUDIT_REPORT.md P1/P2 for why the
 * backend RPCs (all-time, no date range) can't back these figures.
 */

export type PeriodTotals = { income: number; expenses: number; net: number };

export function sumIncomeExpense(transactions: TransactionWithCat[], range: MonthRange): PeriodTotals {
  const inRange = transactions.filter((tx) => isTransactionInRange(tx, range));
  const income = sumTransactionAmounts(inRange.filter(isIncomeTx));
  const expenses = sumTransactionAmounts(inRange.filter(isExpenseTx));
  return { income, expenses, net: income - expenses };
}

/** A window of `monthsCount` whole calendar months, ending with (and including) `now`'s month. */
export function rangeForLastNMonths(monthsCount: number, now: Date = new Date()): MonthRange {
  const start = monthRange(now.getFullYear(), now.getMonth() - (monthsCount - 1)).start;
  const end = monthRange(now.getFullYear(), now.getMonth()).end;
  return { start, end };
}

/** The immediately-preceding window of the same length — for period-over-period comparison. */
export function previousEquivalentRange(range: MonthRange, monthsCount: number): MonthRange {
  const start = new Date(range.start.getFullYear(), range.start.getMonth() - monthsCount, 1);
  return { start, end: range.start };
}

export type MonthlyBucket = { month: string; income: number; expenses: number };

/** `monthsCount` monthly buckets, oldest to newest, ending with `now`'s month. */
export function buildMonthlyBuckets(
  transactions: TransactionWithCat[],
  monthsCount: number,
  now: Date = new Date()
): MonthlyBucket[] {
  const buckets: MonthlyBucket[] = [];
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const bucket = monthRange(now.getFullYear(), now.getMonth() - i);
    const totals = sumIncomeExpense(transactions, bucket);
    buckets.push({
      month: bucket.start.toLocaleDateString(undefined, { month: "short" }),
      income: totals.income,
      expenses: totals.expenses,
    });
  }
  return buckets;
}

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
