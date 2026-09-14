import { useQuery } from "@tanstack/react-query";
import { getBudgetsProgress } from "../../lib/financialAggregates";
import { qk } from "../querykeys";

/**
 * Real per-category expense spend for one budget period, computed
 * server-side and timezone-aware (see budgets_progress() in
 * supabase/migrations/20260915000000_financial_aggregate_functions.sql) --
 * one grouped query for every category in the period, never one request
 * per budget, and never an unbounded transaction fetch.
 */
export function useBudgetsProgress(userId: string, year: number | undefined, month: number | undefined) {
  return useQuery({
    queryKey: qk.budgetsProgress(userId, year ?? 0, month ?? 0),
    queryFn: () => getBudgetsProgress(year as number, month as number),
    // year/month are undefined for the brief window before a caller (e.g.
    // Dashboard) has learned the caller's current local month from
    // dashboard_summary() -- disabled rather than guessing, so this never
    // queries the wrong period. Number.isInteger (not just `!= null`) also
    // guards against ever sending NaN/non-integer garbage to the RPC if an
    // upstream response were ever malformed -- supabase-js JSON-serializes
    // RPC args, and JSON.stringify(NaN) silently becomes `null`, so without
    // this check a NaN year/month wouldn't crash here, but it's a cheap,
    // correct guard to keep this query's own contract honest regardless.
    enabled: !!userId && Number.isInteger(year) && Number.isInteger(month),
    staleTime: 60_000,
  });
}
