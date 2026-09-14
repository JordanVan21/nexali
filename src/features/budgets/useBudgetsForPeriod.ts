import { useMemo } from "react";
import { useBudgets } from "./useBudgets";
import { useBudgetsProgress } from "./useBudgetsProgress";
import { deriveBudgetProgress, type BudgetProgressDetail } from "../../lib/budgetMath";

export type BudgetsPeriodSummary = {
  totalBudget: number;
  totalSpent: number;
  /** totalBudget - totalSpent. Never clamped — can be negative. */
  available: number;
  /** totalSpent / totalBudget * 100. Unclamped — can exceed 100 when the period is over budget overall. */
  efficiency: number;
};

export type BudgetsPeriodData = {
  /** Real budgets for the requested month/year only, with real period-correct spend. */
  budgets: BudgetProgressDetail[];
  summary: BudgetsPeriodSummary;
  /** Count of this period's budgets at warning/critical/over status. */
  warningsCount: number;
  budgetsList: {
    isLoading: boolean;
    isError: boolean;
    /** True once budgets have loaded and the user has never created any budget, in any period. */
    hasNeverCreatedAny: boolean;
    refetch: () => void;
  };
  spendData: {
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
};

/**
 * Real budgets for one month/year, with spend computed server-side
 * (budgets_progress(), timezone-aware via profiles.timezone) for that same
 * period. `useBudgets` already returns every budget the user has ever
 * created (all periods mixed, see docs/AUDIT_REPORT.md P3); the month/year
 * filtering happens here, client-side, against those real rows -- budget
 * definitions are a small, bounded list (one row per budget, not per
 * transaction), so this is not a row-cap concern the way transaction data
 * was.
 */
export function useBudgetsForPeriod(userId: string, year: number, month: number): BudgetsPeriodData {
  const budgetsQuery = useBudgets(userId);
  const spendQuery = useBudgetsProgress(userId, year, month);

  const periodBudgets = useMemo(
    () => (budgetsQuery.data ?? []).filter((b) => b.year === year && b.month === month),
    [budgetsQuery.data, year, month]
  );

  const spendByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of spendQuery.data ?? []) {
      map.set(row.categoryId, row.spent);
    }
    return map;
  }, [spendQuery.data]);

  const progress = useMemo(() => {
    if (!spendQuery.data) return [];
    return periodBudgets.map((b) => deriveBudgetProgress(b, spendByCategory.get(b.category_id ?? -1) ?? 0));
  }, [periodBudgets, spendQuery.data, spendByCategory]);

  const summary = useMemo<BudgetsPeriodSummary>(() => {
    const totalBudget = progress.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = progress.reduce((sum, b) => sum + b.spent, 0);
    return {
      totalBudget,
      totalSpent,
      available: totalBudget - totalSpent,
      efficiency: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
    };
  }, [progress]);

  return {
    budgets: progress,
    summary,
    warningsCount: progress.filter((b) => b.status !== "normal").length,
    budgetsList: {
      isLoading: budgetsQuery.isLoading,
      isError: budgetsQuery.isError,
      hasNeverCreatedAny: !budgetsQuery.isLoading && !budgetsQuery.isError && (budgetsQuery.data?.length ?? 0) === 0,
      refetch: () => void budgetsQuery.refetch(),
    },
    spendData: {
      isLoading: spendQuery.isLoading,
      isError: spendQuery.isError,
      refetch: () => void spendQuery.refetch(),
    },
  };
}
