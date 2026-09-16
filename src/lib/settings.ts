import { supabase } from "../supabaseClient";

/**
 * Payload for the atomic `update_user_settings` RPC (Backend Part 7 fix) --
 * every real, persisted Settings value in one call, so a partial failure
 * (one table updated, the other not) is impossible. No `user_id` field:
 * the function derives the caller from `auth.uid()` server-side and
 * accepts no client-supplied identity.
 */
export type UpdateUserSettingsVars = {
  timezone: string;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  notifyApproaching: boolean;
  notifyExceeded: boolean;
  notifySummary: boolean;
  notifySecurity: boolean;
};

export async function updateUserSettings(vars: UpdateUserSettingsVars): Promise<void> {
  const { error } = await supabase.rpc("update_user_settings", {
    p_timezone: vars.timezone,
    p_currency: vars.currency,
    p_date_format: vars.dateFormat,
    p_number_format: vars.numberFormat,
    p_budget_approaching: vars.notifyApproaching,
    p_budget_exceeded: vars.notifyExceeded,
    p_monthly_summary: vars.notifySummary,
    p_account_security: vars.notifySecurity,
  });

  if (error) throw error;
}
