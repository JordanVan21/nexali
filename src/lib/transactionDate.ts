/** YYYY-MM-DD in the browser's local calendar -- the value an `<input type="date">` needs. */
export function toLocalDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Converts an `<input type="date">` value (YYYY-MM-DD, always the
 * browser's local calendar date, never UTC) into a real ISO timestamp
 * suitable for `transactions.occurred_at`.
 *
 * Stored at local noon rather than local midnight so the chosen calendar
 * date can never appear to shift by a day when later re-displayed via
 * `toLocaleDateString()` in the same browser/timezone context -- which is
 * the only context Nexali's date rendering currently accounts for
 * anywhere in the app (see docs/BACKEND_AUDIT_REPORT.md P2-2:
 * `profiles.timezone` is persisted but not yet read by any date/period
 * calculation; this helper preserves that existing browser-local
 * behavior rather than introducing new, inconsistent timezone logic).
 */
export function occurredAtFromLocalDateInput(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0).toISOString();
}
