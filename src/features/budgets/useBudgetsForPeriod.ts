import { useMemo } from "react";
import { useBudgets } from "./useBudgets";
import { useTransactions } from "../transactions/useTransactions";
import { computeBudgetProgress, type BudgetProgressDetail } from "../../lib/budgetMath";

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
 * Real budgets for one month/year, with spend computed from the user's
 * actual transactions for that same period (src/lib/budgetMath.ts) —
 * never the all-time `sum_category_amount` RPC. `useBudgets` already
 * returns every budget the user has ever created (all periods mixed, see
 * docs/AUDIT_REPORT.md P3); the month/year filtering happens here,
 * client-side, against those real rows.
 */
export function useBudgetsForPeriod(userId: string, year: number, month: number): BudgetsPeriodData {
  const budgetsQuery = useBudgets(userId);
  const txQuery = useTransactions(userId);

  const periodBudgets = useMemo(
    () => (budgetsQuery.data ?? []).filter((b) => b.year === year && b.month === month),
    [budgetsQuery.data, year, month]
  );

  const progress = useMemo(() => {
    if (!txQuery.data) return [];
    return periodBudgets.map((b) => computeBudgetProgress(txQuery.data, b));
  }, [periodBudgets, txQuery.data]);

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
      isLoading: txQuery.isLoading,
      isError: txQuery.isError,
      refetch: () => void txQuery.refetch(),
    },
  };
}
