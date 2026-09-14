import { useQuery } from "@tanstack/react-query";
import { getTransactionCategoryCounts } from "../../lib/financialAggregates";
import { qk } from "../querykeys";

/**
 * Real, all-time, server-computed transaction count per category name, for
 * the Transactions page's category-filter dropdown badges (see
 * transaction_category_counts() -- Backend Part 5). Replaces fetching the
 * user's entire transaction history into the browser just to count rows
 * per category client-side.
 */
export function useTransactionCategoryCounts(userId: string) {
  return useQuery({
    queryKey: qk.categoryCounts(userId),
    queryFn: () => getTransactionCategoryCounts(),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
