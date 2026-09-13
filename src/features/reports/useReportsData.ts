import { useMemo } from "react";
import { useTransactions } from "../transactions/useTransactions";
import { useBudgets } from "../budgets/useBudgets";
import {
  rangeForLastNMonths,
  previousEquivalentRange,
  sumIncomeExpense,
  buildMonthlyBuckets,
  expenseCategoryTotals,
  savingsRate,
  type PeriodTotals,
  type MonthlyBucket,
  type CategoryAmount,
} from "../../lib/financialAnalytics";
import { computeBudgetProgress, type BudgetProgressDetail } from "../../lib/budgetMath";
import { isTransactionInRange, type MonthRange } from "../../lib/financialPeriods";
import type { TransactionWithCat } from "../../lib/transactions";

export type ReportPeriodOption = 1 | 3 | 6 | 12;

export const REPORT_PERIODS: { value: ReportPeriodOption; label: string; comparisonLabel: string }[] = [
  { value: 1, label: "This Month", comparisonLabel: "last month" },
  { value: 3, label: "3 Months", comparisonLabel: "the previous 3 months" },
  { value: 6, label: "6 Months", comparisonLabel: "the previous 6 months" },
  { value: 12, label: "12 Months", comparisonLabel: "the previous 12 months" },
];

export const ALL_CATEGORIES = "All Categories";

const EMPTY_TRANSACTIONS: TransactionWithCat[] = [];

export type ReportsData = {
  range: MonthRange;
  totals: PeriodTotals;
  /** null only while transactions are still loading; otherwise always a real (possibly zero) total. */
  previousTotals: PeriodTotals | null;
  savingsRatePercent: number | null;
  /** One bucket per month in the selected period, oldest to newest. */
  monthlyBuckets: MonthlyBucket[];
  /** Full real expense breakdown for the selected period and category filter — not topN-limited. */
  categoryTotals: CategoryAmount[];
  /** Same categories, previous equivalent period — for per-category "vs previous period" change. */
  previousCategoryTotals: CategoryAmount[];
  /** Real expense category names present anywhere in the user's history, for the filter control. */
  categoryNames: string[];
  /** Real budgets (with real period-correct spend) whose month/year falls inside the selected range. */
  budgetsInRange: BudgetProgressDetail[];
  /** Real transactions inside the selected range/category filter — the exact rows Export CSV writes out. */
  transactionsInRange: TransactionWithCat[];
  transactionsList: {
    isLoading: boolean;
    isError: boolean;
    hasAnyDataEver: boolean;
    refetch: () => void;
  };
  budgetsList: {
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
};

/**
 * Real, period-correct Reports data — mirrors Dashboard's useDashboardData
 * and Budgets' useBudgetsForPeriod, but over an arbitrary N-month window
 * instead of a single fixed month. Built entirely from src/lib/financialAnalytics.ts
 * and src/lib/budgetMath.ts so all three features share identical period math.
 */
export function useReportsData(
  userId: string,
  monthsCount: ReportPeriodOption,
  categoryName: string,
  now: Date = new Date()
): ReportsData {
  const txQuery = useTransactions(userId);
  const budgetsQuery = useBudgets(userId);

  const range = useMemo(() => rangeForLastNMonths(monthsCount, now), [monthsCount, now]);
  const previousRange = useMemo(() => previousEquivalentRange(range, monthsCount), [range, monthsCount]);

  const transactions = txQuery.data ?? EMPTY_TRANSACTIONS;

  const totals = useMemo(() => sumIncomeExpense(transactions, range), [transactions, range]);
  const previousTotals = useMemo<PeriodTotals | null>(
    () => (txQuery.data ? sumIncomeExpense(transactions, previousRange) : null),
    [txQuery.data, transactions, previousRange]
  );

  const monthlyBuckets = useMemo(
    () => buildMonthlyBuckets(transactions, monthsCount, range.end),
    [transactions, monthsCount, range]
  );

  const categoryTotals = useMemo(
    () => expenseCategoryTotals(transactions, range, { categoryName }),
    [transactions, range, categoryName]
  );
  const previousCategoryTotals = useMemo(
    () => expenseCategoryTotals(transactions, previousRange, { categoryName }),
    [transactions, previousRange, categoryName]
  );

  const categoryNames = useMemo(() => {
    const names = new Set<string>();
    for (const tx of transactions) {
      if (tx.categories?.type === "expense") names.add(tx.categories.name);
    }
    return [ALL_CATEGORIES, ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [transactions]);

  const transactionsInRange = useMemo(
    () =>
      transactions.filter(
        (tx) =>
          isTransactionInRange(tx, range) &&
          (categoryName === ALL_CATEGORIES || (tx.categories?.name ?? "Uncategorized") === categoryName)
      ),
    [transactions, range, categoryName]
  );

  const budgetsInRange = useMemo(() => {
    if (!txQuery.data) return [];
    return (budgetsQuery.data ?? [])
      .filter((b) => {
        const bucketStart = new Date(b.year, b.month - 1, 1).getTime();
        return bucketStart >= range.start.getTime() && bucketStart < range.end.getTime();
      })
      .map((b) => computeBudgetProgress(transactions, b))
      .sort((a, b) => a.year - b.year || a.month - b.month || a.category.localeCompare(b.category));
  }, [txQuery.data, budgetsQuery.data, transactions, range]);

  return {
    range,
    totals,
    previousTotals,
    savingsRatePercent: savingsRate(totals.income, totals.expenses),
    monthlyBuckets,
    categoryTotals,
    previousCategoryTotals,
    categoryNames,
    budgetsInRange,
    transactionsInRange,
    transactionsList: {
      isLoading: txQuery.isLoading,
      isError: txQuery.isError,
      hasAnyDataEver: (txQuery.data?.length ?? 0) > 0,
      refetch: () => void txQuery.refetch(),
    },
    budgetsList: {
      isLoading: budgetsQuery.isLoading,
      isError: budgetsQuery.isError,
      refetch: () => void budgetsQuery.refetch(),
    },
  };
}
