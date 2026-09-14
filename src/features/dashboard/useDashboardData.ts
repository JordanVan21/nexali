import { useMemo } from "react";
import { useDashboardSummary } from "./useDashboardSummary";
import { useBudgets } from "../budgets/useBudgets";
import { useBudgetsProgress } from "../budgets/useBudgetsProgress";
import { mapDashboardSummary, type DashboardSummary } from "./dashboardMath";

export type DashboardData = {
  summary: DashboardSummary | null;
  transactions: {
    isLoading: boolean;
    isError: boolean;
    hasData: boolean;
    refetch: () => void;
  };
  budgets: {
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
};

/**
 * Combines the server-computed transaction summary (dashboard_summary(),
 * timezone-aware and bounded -- see useDashboardSummary.ts) with the
 * server-computed budget spend for the same period (budgets_progress(),
 * shared with the Budgets page) into the DashboardSummary the page
 * renders. Kept as two independent queries/error states -- exactly as
 * before this Part -- so a budgets failure only ever blanks the budget
 * panel, never the rest of the Dashboard.
 */
export function useDashboardData(userId: string): DashboardData {
  const summaryQuery = useDashboardSummary(userId);
  const budgetsQuery = useBudgets(userId);
  const progressQuery = useBudgetsProgress(userId, summaryQuery.data?.currentYear, summaryQuery.data?.currentMonth);

  const periodBudgets = useMemo(() => {
    if (!summaryQuery.data) return [];
    const { currentYear, currentMonth } = summaryQuery.data;
    return (budgetsQuery.data ?? []).filter((b) => b.year === currentYear && b.month === currentMonth);
  }, [budgetsQuery.data, summaryQuery.data]);

  const summary = useMemo(() => {
    if (!summaryQuery.data || !progressQuery.data) return null;
    return mapDashboardSummary(summaryQuery.data, periodBudgets, progressQuery.data);
  }, [summaryQuery.data, progressQuery.data, periodBudgets]);

  return {
    summary,
    transactions: {
      isLoading: summaryQuery.isLoading,
      isError: summaryQuery.isError,
      hasData: (summaryQuery.data?.recentTransactions.length ?? 0) > 0,
      refetch: () => void summaryQuery.refetch(),
    },
    budgets: {
      // progressQuery.isPending (not isLoading) deliberately -- it stays
      // true for the whole window before summaryQuery has resolved
      // currentYear/currentMonth (progressQuery is disabled until then, so
      // TanStack's own isLoading briefly reads false while idle). That
      // window is already hidden behind the transactions.isLoading gate
      // above, so this only matters once summary is available, at which
      // point isPending correctly tracks "no budget-progress data yet".
      isLoading: budgetsQuery.isLoading || progressQuery.isPending,
      isError: budgetsQuery.isError || progressQuery.isError,
      refetch: () => {
        void budgetsQuery.refetch();
        void progressQuery.refetch();
      },
    },
  };
}
