import { formatInTimeZone } from "./timezone";

/**
 * Preferred calendar-date display pattern for user-facing transaction
 * dates -- backed by `profiles.date_format` (Backend Part 6). Matches the
 * real Settings page's DATE_FORMAT_OPTIONS values exactly.
 */
export type DateFormatPref = "mdy" | "dmy" | "ymd";

/**
 * Formats `date` (a real instant, e.g. a transaction's `occurred_at`) as a
 * calendar date per `dateFormat`, read in `timeZone` (the caller's
 * configured `profiles.timezone`, established in Backend Part 4) rather
 * than the browser's own timezone -- so the displayed calendar day always
 * matches the day the transaction was actually entered against, not
 * wherever the viewing browser happens to be.
 *
 * This is a USER-FACING CALENDAR DATE formatter -- do not use it for the
 * CSV export's Date column (deliberately kept as stable YYYY-MM-DD
 * regardless of this preference, see buildTransactionsCsv/Backend Part 6)
 * or for month/year-only labels (e.g. Dashboard's cashflow chart, "Member
 * since [Month Year]"), which are a different, semantic label kind that
 * date_format's day-precision patterns don't apply to.
 */
export function formatDate(date: Date, dateFormat: DateFormatPref, timeZone: string): string {
  const iso = formatInTimeZone(date, timeZone); // "YYYY-MM-DD"
  const [year, month, day] = iso.split("-");
  switch (dateFormat) {
    case "dmy":
      return `${day}/${month}/${year}`;
    case "ymd":
      return iso;
    case "mdy":
    default:
      return `${month}/${day}/${year}`;
  }
}
