import { zonedTimeToUtc, formatInTimeZone, parseDateInputValue, browserTimeZone } from "./timezone";

/**
 * YYYY-MM-DD as it reads on a wall clock in `timeZone` -- the value an
 * `<input type="date">` needs. `timeZone` should be the user's configured
 * `profiles.timezone`; pass `browserTimeZone()` explicitly only for the
 * brief window before that has loaded.
 */
export function toZonedDateInputValue(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone);
}

/**
 * Converts an `<input type="date">` value (YYYY-MM-DD) into a real ISO
 * timestamp suitable for `transactions.occurred_at`, anchored to noon in
 * `timeZone` -- which must be the user's CONFIGURED `profiles.timezone`,
 * not the browser's machine timezone. Those two can differ (a user
 * travelling, a misconfigured OS clock, ...), and the selected calendar
 * date must represent the same day when later re-displayed in the user's
 * configured timezone regardless of which timezone picked it.
 *
 * Noon (rather than midnight) keeps the stored instant safely away from any
 * DST transition, which always occurs near local midnight, so the chosen
 * calendar date can never appear to shift by a day once re-read in the same
 * configured timezone. See docs/BACKEND_AUDIT_REPORT.md Backend Part 4 for
 * the full rationale and the browser-vs-configured-timezone scenario this
 * replaces (the previous version anchored to the BROWSER's local noon,
 * which could shift the stored calendar date when the browser's timezone
 * differed from profiles.timezone).
 */
export function occurredAtFromZonedDateInput(value: string, timeZone: string): string {
  const parts = parseDateInputValue(value);
  return zonedTimeToUtc(parts, timeZone).toISOString();
}

/**
 * Fallback IANA timezone for the brief window before the user's real
 * `profiles.timezone` has loaded (e.g. the very first render of the
 * Add Transaction form). Once the profile query resolves, callers should
 * switch to the real configured timezone -- this only avoids a wrong
 * calendar date being shown while that request is still in flight.
 */
export function fallbackTimeZone(): string {
  return browserTimeZone();
}
