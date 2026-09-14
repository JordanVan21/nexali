/**
 * IANA-timezone-aware date conversion helpers, built on the platform Intl
 * API only -- no date library dependency needed.
 *
 * Why this exists: `profiles.timezone` is the user's CONFIGURED financial
 * timezone, which is not necessarily the timezone their browser happens to
 * be running in right now (see docs/BACKEND_AUDIT_REPORT.md Backend Part 4).
 * A date the user picks -- a transaction date, a date-range filter bound --
 * must resolve to the same real-world instant regardless of which machine
 * timezone picked it, so every conversion here takes an explicit IANA
 * `timeZone` string rather than trusting `Date`'s own browser-local
 * getters/setters.
 */

export type DateParts = { year: number; month: number; day: number };

/** YYYY-MM-DD for `date` as it reads on a wall clock in `timeZone`. */
export function formatInTimeZone(date: Date, timeZone: string): string {
  // en-CA's built-in date format is YYYY-MM-DD, so no manual part-reassembly is needed.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * How far `timeZone`'s local wall clock is ahead of UTC at approximately
 * `utcGuessMs`, in milliseconds (e.g. +2 hours for a zone at UTC+2). Reads
 * the real offset in effect near that instant, so this is correct across
 * DST transitions instead of assuming a fixed offset.
 */
function offsetMillisAt(utcGuessMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcGuessMs));

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return asIfUtc - utcGuessMs;
}

/**
 * The real UTC instant for the given wall-clock date/time as it would read
 * on a clock in `timeZone` -- e.g. the instant of noon on 2026-09-01 in
 * America/Los_Angeles, regardless of the timezone the code happens to be
 * running in. Defaults to noon so date-only values land safely away from
 * any DST transition, which always occurs near local midnight.
 */
export function zonedTimeToUtc(parts: DateParts, timeZone: string, hour = 12, minute = 0, second = 0): Date {
  const naiveUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second);
  // The offset right at naiveUtcMs is already within a few minutes of the
  // real target instant for any real-world zone, so one correction pass is
  // enough -- a second pass would only matter within seconds of a DST
  // transition, which noon-anchoring already avoids.
  const offset = offsetMillisAt(naiveUtcMs, timeZone);
  return new Date(naiveUtcMs - offset);
}

/** Parses a `<input type="date">` value (YYYY-MM-DD) into its numeric parts. */
export function parseDateInputValue(value: string): DateParts {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month: month || 1, day: day || 1 };
}

/** The browser's own IANA timezone -- only a fallback for the brief window before profile.timezone has loaded. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
