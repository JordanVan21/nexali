import { useMemo } from "react";
import { useTransactions } from "../transactions/useTransactions";
import { useBudgets } from "../budgets/useBudgets";
import { computeDashboardSummary, type DashboardSummary } from "./dashboardMath";

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
 * Combines the real transaction and budget queries into the period-correct
 * summary the Dashboard renders. Transactions and budgets are kept as
 * separate loading/error states (rather than one merged flag) so a failure
 * in one does not have to blank out sections that only depend on the other
 * — see dashboardMath.ts for why the summary itself is computed
 * client-side instead of trusting the all-time backend RPCs.
 */
export function useDashboardData(userId: string): DashboardData {
  const txQuery = useTransactions(userId);
  const budgetsQuery = useBudgets(userId);

  const summary = useMemo(() => {
    if (!txQuery.data) return null;
    return computeDashboardSummary(txQuery.data, budgetsQuery.data ?? []);
  }, [txQuery.data, budgetsQuery.data]);

  return {
    summary,
    transactions: {
      isLoading: txQuery.isLoading,
      isError: txQuery.isError,
      hasData: (txQuery.data?.length ?? 0) > 0,
      refetch: () => void txQuery.refetch(),
    },
    budgets: {
      isLoading: budgetsQuery.isLoading,
      isError: budgetsQuery.isError,
      refetch: () => void budgetsQuery.refetch(),
    },
  };
}
