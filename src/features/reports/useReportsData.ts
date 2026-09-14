import { useMemo } from "react";
import { useReportsSummary } from "./useReportsSummary";
import { useBudgets } from "../budgets/useBudgets";
import { useExportTransactionsWithFilters } from "../transactions/useTransactions";
import { deriveBudgetProgress, type BudgetProgressDetail } from "../../lib/budgetMath";
import type { MonthRange } from "../../lib/financialPeriods";
import { savingsRate, type MonthlyBucket, type CategoryAmount, type PeriodTotals } from "../../lib/financialAnalytics";
import type { Filters } from "../querykeys";
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
  /** null only while the summary is still loading; otherwise always a real (possibly zero) total. */
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
  /** Real transactions inside the selected range/category filter — the exact rows Export CSV writes out, fetched in bounded batches (see useExportTransactionsWithFilters). */
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

/** `month`/`year` -> a short locale-aware month label (e.g. "Jun"), matching the label format Nexali has always used. */
function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

/**
 * Real, period-correct, timezone-aware Reports data — mirrors Dashboard's
 * useDashboardData and Budgets' useBudgetsForPeriod, but over an arbitrary
 * N-month window instead of a single fixed month. Built on
 * reports_summary() (see docs/BACKEND_AUDIT_REPORT.md Backend Part 4)
 * instead of fetching and scanning the user's entire transaction history.
 */
export function useReportsData(
  userId: string,
  monthsCount: ReportPeriodOption,
  categoryName: string,
  now: Date = new Date()
): ReportsData {
  const summaryQuery = useReportsSummary(userId, monthsCount, categoryName);
  const budgetsQuery = useBudgets(userId);

  const range: MonthRange = useMemo(() => {
    if (summaryQuery.data) {
      return { start: new Date(summaryQuery.data.rangeStart), end: new Date(summaryQuery.data.rangeEnd) };
    }
    // A reasonable placeholder while the real server-computed range is
    // still loading -- never rendered, since every consumer gates on
    // transactionsList.isLoading first.
    return { start: now, end: now };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryQuery.data]);

  const exportFilters: Filters = useMemo(() => {
    const filters: Filters = { fromISO: range.start.toISOString(), toISO: range.end.toISOString() };
    if (categoryName !== ALL_CATEGORIES) filters.categoryNames = [categoryName];
    return filters;
  }, [range, categoryName]);

  const exportQuery = useExportTransactionsWithFilters(userId, exportFilters);

  const monthlyBuckets: MonthlyBucket[] = useMemo(
    () => (summaryQuery.data?.monthlyBuckets ?? []).map((b) => ({ month: monthLabel(b.year, b.month), income: b.income, expenses: b.expenses })),
    [summaryQuery.data]
  );

  const budgetsInRange = useMemo<BudgetProgressDetail[]>(() => {
    if (!summaryQuery.data || !budgetsQuery.data) return [];
    const spendByKey = new Map<string, number>();
    for (const row of summaryQuery.data.budgetsInRange) {
      spendByKey.set(`${row.categoryId}:${row.year}:${row.month}`, row.spent);
    }
    return budgetsQuery.data
      .filter((b) => {
        const bucketStart = new Date(b.year, b.month - 1, 1).getTime();
        return bucketStart >= range.start.getTime() && bucketStart < range.end.getTime();
      })
      .map((b) => deriveBudgetProgress(b, spendByKey.get(`${b.category_id}:${b.year}:${b.month}`) ?? 0))
      .sort((a, b) => a.year - b.year || a.month - b.month || a.category.localeCompare(b.category));
  }, [summaryQuery.data, budgetsQuery.data, range]);

  return {
    range,
    totals: summaryQuery.data?.totals ?? { income: 0, expenses: 0, net: 0 },
    previousTotals: summaryQuery.data?.previousTotals ?? null,
    savingsRatePercent: summaryQuery.data ? savingsRate(summaryQuery.data.totals.income, summaryQuery.data.totals.expenses) : null,
    monthlyBuckets,
    categoryTotals: summaryQuery.data?.categoryTotals ?? [],
    previousCategoryTotals: summaryQuery.data?.previousCategoryTotals ?? [],
    categoryNames: [ALL_CATEGORIES, ...(summaryQuery.data?.categoryNames ?? [])],
    budgetsInRange,
    transactionsInRange: exportQuery.data ?? EMPTY_TRANSACTIONS,
    transactionsList: {
      isLoading: summaryQuery.isLoading,
      isError: summaryQuery.isError,
      hasAnyDataEver: summaryQuery.data?.hasAnyTransactionsEver ?? false,
      refetch: () => void summaryQuery.refetch(),
    },
    budgetsList: {
      isLoading: budgetsQuery.isLoading,
      isError: budgetsQuery.isError,
      refetch: () => void budgetsQuery.refetch(),
    },
  };
}
