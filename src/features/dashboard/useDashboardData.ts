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
    // Deliberately gated on summaryQuery.data ALONE, matching
    // dashboard.transactions.isLoading/isError/hasData below (all three
    // also derive purely from summaryQuery) -- month/prevMonth/cashflow/
    // categoryBreakdown/recentTransactions never depended on budget-progress
    // data in the first place (see mapDashboardSummary). Requiring
    // progressQuery.data too here (as a previous version of this file did)
    // decoupled "is summary safe to render" from "is transactions.isLoading
    // false", which on a cold cache let Dashboard.tsx reach its `summary!.*`
    // render branch for one render while `summary` was still null --
    // `progressQuery` only *becomes* enabled once summaryQuery.data
    // supplies currentYear/currentMonth, so its own data is never populated
    // in that same render, throwing a TypeError caught by the page Error
    // Boundary. `spendRows` defaults to [] while budget-progress hasn't
    // loaded yet -- the budget figures it feeds (`summary.budgets`/
    // `warningsCount`) read as a real, if momentarily stale, zero until
    // progressQuery resolves, exactly mirroring how this hook worked before
    // Backend Part 4 (`budgetsQuery.data ?? []`) -- the BudgetSnapshot
    // panel itself still has its own independent `dashboard.budgets.isLoading`
    // skeleton gate below, unaffected by this.
    if (!summaryQuery.data) return null;
    return mapDashboardSummary(summaryQuery.data, periodBudgets, progressQuery.data ?? []);
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
