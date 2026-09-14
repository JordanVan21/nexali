import { useMemo, type ReactNode } from "react";
import { useProfile } from "./useProfile";
import { useUserInfo } from "../../shared/useUserId";
import { browserTimeZone } from "../../lib/timezone";
import type { NumberFormatPref } from "../../lib/format";
import type { DateFormatPref } from "../../lib/dateFormat";
import { FormatPreferencesContext, DEFAULT_PREFERENCES, type FormatPreferences } from "./formatPreferencesStore";

/**
 * Provides the caller's persisted currency/number/date-format/timezone
 * preferences (`profiles.currency`/`number_format`/`date_format`/`timezone`,
 * Backend Part 6) to every page/component beneath it via context, backed by
 * a SINGLE `useProfile(userId)` call -- the same cached query key every
 * other Profile/Settings/Dashboard/Reports/Transactions consumer already
 * shares, so mounting this once near the app root (see AppLayout.tsx) adds
 * no new network request; it only avoids every leaf component that
 * currently calls `formatCurrency` needing its own `useProfile` subscription.
 * Falls back to Nexali's pre-Backend-Part-6 defaults (USD, standard,
 * mdy, browser timezone) for the brief window before the profile query
 * resolves, and for a signed-out render -- never blocks rendering on this.
 */
export function FormatPreferencesProvider({ children }: { children: ReactNode }) {
  const { userId } = useUserInfo();
  const profile = useProfile(userId);

  const value = useMemo<FormatPreferences>(() => {
    if (!profile.data) {
      return { ...DEFAULT_PREFERENCES, timeZone: browserTimeZone() };
    }
    return {
      currency: profile.data.currency,
      numberFormat: profile.data.number_format as NumberFormatPref,
      dateFormat: profile.data.date_format as DateFormatPref,
      timeZone: profile.data.timezone,
    };
  }, [profile.data]);

  return <FormatPreferencesContext.Provider value={value}>{children}</FormatPreferencesContext.Provider>;
}
