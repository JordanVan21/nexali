import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUserSettings, type UpdateUserSettingsVars } from "../../lib/settings";
import { qk } from "../querykeys";

export type UpdateUserSettingsMutationVars = UpdateUserSettingsVars & {
  /** The timezone value as last persisted (Settings' `saved.timezone`) -- compared against `vars.timezone` to decide whether timezone-dependent financial caches need invalidating. */
  previousTimezone: string;
};

/**
 * Backend Part 7 fix: Settings' Save Changes action now persists
 * profiles(timezone/currency/date_format/number_format) AND
 * notification_preferences(the four switches) through ONE atomic RPC
 * (update_user_settings -- one PostgreSQL function call, one transaction),
 * replacing the previous Promise.all(updateProfile.mutateAsync,
 * updatePreferences.mutateAsync) which could partially succeed.
 *
 * Cache invalidation mirrors useUpdateProfile's existing
 * isTimezoneChange split (Backend Part 6): profile + notification
 * preferences are always invalidated on success; the four
 * timezone-dependent financial aggregate caches are invalidated ONLY when
 * timezone actually changed -- a currency/date/number-format-only or
 * notification-preference-only save never refetches financial data.
 */
export function useUpdateUserSettings(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: UpdateUserSettingsMutationVars) => {
      await updateUserSettings(vars);
      return { timezoneChanged: vars.timezone !== vars.previousTimezone };
    },
    onSuccess: async ({ timezoneChanged }) => {
      if (!userId) return;
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.profile(userId) }),
        qc.invalidateQueries({ queryKey: qk.notificationPreferences(userId) }),
      ]);
      if (timezoneChanged) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: qk.dashboardSummary(userId) }),
          qc.invalidateQueries({ queryKey: qk.reportsSummaryRoot(userId) }),
          qc.invalidateQueries({ queryKey: qk.budgetsProgressRoot(userId) }),
          qc.invalidateQueries({ queryKey: qk.activitySummaryRoot(userId) }),
        ]);
      }
    },
  });
}
