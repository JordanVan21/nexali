import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile } from "../../lib/profile";
import { qk } from "../querykeys";
import { supabase } from "../../supabaseClient";

export function useProfile(userId?: string) {
    return useQuery({
        queryKey: userId ? qk.profile(userId) : ["profile", "disabled"] as const,
        queryFn: () => getProfile(userId!),
        enabled: !!userId,
        staleTime: 60000,
    })
}

export type UpdateProfileVars = Partial<{
    full_name: string;
    budget_reset_cycle: string;
    reset_day: number;
    timezone: string;
    phone: string | null;
    location: string | null;
    financial_bio: string | null;
    currency: string;
    date_format: string;
    number_format: string;
}>;

/**
 * `invalidateTimezoneDependentQueries` is true whenever `vars` changes
 * `timezone` -- timezone changes real financial-period *semantics* (every
 * server aggregate re-derives "this month"/"this period" from
 * profiles.timezone, see Backend Part 4), so every timezone-dependent
 * cache must be invalidated/refetched, not just the profile cache itself.
 * `currency`/`date_format`/`number_format` are display-only preferences --
 * the underlying numbers/periods those caches hold haven't changed, so
 * changing them deliberately does NOT invalidate any financial aggregate
 * (see docs/BACKEND_AUDIT_REPORT.md Backend Part 6).
 */
function isTimezoneChange(vars: UpdateProfileVars): boolean {
  return typeof vars.timezone === "string";
}

export function useUpdateProfile(userId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (vars: UpdateProfileVars) => {
            const { error } = await supabase
                  .from("profiles")
                  .update(vars)
                  .eq("id", userId);
            if (error) throw error;
            return vars;
        },
        onSuccess: async (vars) => {
      if (!userId) return;
      await qc.invalidateQueries({ queryKey: qk.profile(userId) });
      if (isTimezoneChange(vars)) {
        // transaction_category_counts() is deliberately excluded -- it's an
        // all-time, filter-independent tally with no date-boundary logic at
        // all (see Backend Part 5), so it cannot go stale from a timezone
        // change. Transactions-page filtered/export queries (qk.txRoot) are
        // also excluded: their cached results were correct for whatever
        // calendar days were selected using the timezone in effect AT
        // SELECTION TIME; a new date-range selection made after the
        // timezone change picks up the new timezone naturally (the picker
        // reads profile.timezone fresh on every render), with nothing to
        // invalidate.
        await Promise.all([
          qc.invalidateQueries({ queryKey: qk.dashboardSummary(userId) }),
          qc.invalidateQueries({ queryKey: qk.reportsSummaryRoot(userId) }),
          qc.invalidateQueries({ queryKey: qk.budgetsProgressRoot(userId) }),
          qc.invalidateQueries({ queryKey: qk.activitySummaryRoot(userId) }),
        ]);
      }
    },});
}