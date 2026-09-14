import { useContext, useMemo } from "react";
import { FormatPreferencesContext, DEFAULT_PREFERENCES, type FormatPreferences } from "./formatPreferencesStore";
import { formatCurrency as formatCurrencyRaw } from "../../lib/format";
import { formatDate as formatDateRaw } from "../../lib/dateFormat";

/** Real persisted currency/number/date-format/timezone preferences -- see FormatPreferencesProvider (AppLayout.tsx). */
export function useFormatPreferences(): FormatPreferences {
  const ctx = useContext(FormatPreferencesContext);
  // Falls back to defaults (rather than throwing) for the handful of
  // isolated unit tests that render a component without the provider --
  // every real page is rendered under AppLayout's provider.
  return ctx ?? DEFAULT_PREFERENCES;
}

/** A `formatCurrency(amount)` bound to the caller's real persisted currency/number-format preferences. */
export function useFormatCurrency(): (amount: number) => string {
  const { currency, numberFormat } = useFormatPreferences();
  return useMemo(() => (amount: number) => formatCurrencyRaw(amount, currency, numberFormat), [currency, numberFormat]);
}

/** A `formatDate(date)` bound to the caller's real persisted date-format/timezone preferences. */
export function useFormatDate(): (date: Date | string) => string {
  const { dateFormat, timeZone } = useFormatPreferences();
  return useMemo(
    () => (date: Date | string) => formatDateRaw(typeof date === "string" ? new Date(date) : date, dateFormat, timeZone),
    [dateFormat, timeZone]
  );
}
