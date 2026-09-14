import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "../../lib/financialAggregates";
import { qk } from "../querykeys";

/**
 * Real, server-computed, timezone-aware Dashboard totals/cashflow/category
 * breakdown/recent-activity for the caller's current calendar month (see
 * dashboard_summary() in supabase/migrations/20260915000000_financial_aggregate_functions.sql).
 * Replaces fetching the user's entire transaction history into the browser
 * just to compute a bounded monthly summary from it.
 */
export function useDashboardSummary(userId: string) {
  return useQuery({
    queryKey: qk.dashboardSummary(userId),
    queryFn: () => getDashboardSummary(),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
