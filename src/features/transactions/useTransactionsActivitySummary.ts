import { useQuery } from "@tanstack/react-query";
import { getTransactionsActivitySummary } from "../../lib/financialAggregates";
import { qk } from "../querykeys";

/**
 * Real, server-computed, timezone-aware "Average Daily Burn"/"Top
 * Categories" data for the Transactions page (see
 * transactions_activity_summary() -- Backend Part 5). `fromISO`/`toISO`
 * should be the Transactions page's active date-filter bounds (both given
 * together), or both omitted for the default month-to-date period.
 */
export function useTransactionsActivitySummary(userId: string, fromISO?: string, toISO?: string) {
  return useQuery({
    queryKey: qk.activitySummary(userId, fromISO, toISO),
    queryFn: () => getTransactionsActivitySummary(fromISO, toISO),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
