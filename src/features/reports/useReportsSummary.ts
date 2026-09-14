import { useQuery } from "@tanstack/react-query";
import { getReportsSummary } from "../../lib/financialAggregates";
import { qk } from "../querykeys";

/**
 * Real, server-computed, timezone-aware Reports data for an N-month window
 * (see reports_summary() in
 * supabase/migrations/20260915000000_financial_aggregate_functions.sql).
 * Replaces fetching the user's entire transaction history into the browser
 * just to compute a bounded multi-month report from it.
 */
export function useReportsSummary(userId: string, monthsCount: number, categoryName: string) {
  return useQuery({
    queryKey: qk.reportsSummary(userId, monthsCount, categoryName),
    queryFn: () => getReportsSummary(monthsCount, categoryName),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
