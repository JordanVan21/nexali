/**
 * Preferred thousands/decimal separator convention for formatted monetary
 * amounts -- backed by `profiles.number_format` (Backend Part 6). Matches
 * the real Settings page's NUMBER_FORMAT_OPTIONS values exactly.
 */
export type NumberFormatPref = "standard" | "european" | "space";

/**
 * Base locale used purely for its separator/symbol-placement CONVENTION --
 * `currency` (the ISO code, e.g. "EUR") is always passed separately, so
 * picking `de-DE` here does not mean amounts render in German; it means
 * Nexali borrows German's period-thousands/comma-decimal convention while
 * still using the user's own selected currency code and symbol.
 */
const LOCALE_FOR_NUMBER_FORMAT: Record<NumberFormatPref, string> = {
  standard: "en-US", // 1,234.56
  european: "de-DE", // 1.234,56
  space: "en-US", // 1,234.56 first, then re-separated below to 1 234.56
};

/**
 * Formats `amount` as a real currency string using the user's persisted
 * display preferences. `currency` is a FORMAT/DISPLAY convention only
 * (profiles.currency) -- this never performs FX conversion; a stored
 * dollar amount is rendered with a different symbol/code if the user picks
 * a different currency, never mathematically converted (see
 * docs/BACKEND_AUDIT_REPORT.md Backend Part 6). `numberFormat`
 * (profiles.number_format) independently controls separator style and is
 * never overridden by the currency choice -- see LOCALE_FOR_NUMBER_FORMAT.
 */
export function formatCurrency(
  amount: number,
  currency = "USD",
  numberFormat: NumberFormatPref = "standard"
): string {
  const locale = LOCALE_FOR_NUMBER_FORMAT[numberFormat];
  const formatted = new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  // "space": every real-world space-thousands locale (fr-FR, sv-SE, ...)
  // also uses a comma decimal separator, which does not match Nexali's own
  // documented "space" example (space thousands, PERIOD decimal -- see
  // Settings' NUMBER_FORMAT_OPTIONS: "1 234.56"). Post-processing the
  // "standard" (en-US) output deterministically guarantees the exact
  // documented pattern regardless of ICU locale-data differences across
  // environments/browsers.
  return numberFormat === "space" ? formatted.replace(/,/g, " ") : formatted;
}
