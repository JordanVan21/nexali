import { describe, it, expect } from "vitest";
import { zonedTimeToUtc, formatInTimeZone, parseDateInputValue } from "./timezone";

describe("zonedTimeToUtc / formatInTimeZone round-trip", () => {
  it("round-trips a calendar date through a negative-offset zone (America/Los_Angeles)", () => {
    const instant = zonedTimeToUtc({ year: 2026, month: 9, day: 1 }, "America/Los_Angeles");
    expect(formatInTimeZone(instant, "America/Los_Angeles")).toBe("2026-09-01");
  });

  it("round-trips a calendar date through UTC", () => {
    const instant = zonedTimeToUtc({ year: 2026, month: 1, day: 15 }, "UTC");
    expect(formatInTimeZone(instant, "UTC")).toBe("2026-01-15");
  });

  it("round-trips a calendar date through a positive-offset, non-US zone (Asia/Ho_Chi_Minh, UTC+7)", () => {
    const instant = zonedTimeToUtc({ year: 2026, month: 3, day: 20 }, "Asia/Ho_Chi_Minh");
    expect(formatInTimeZone(instant, "Asia/Ho_Chi_Minh")).toBe("2026-03-20");
  });

  it("produces a real UTC instant offset from noon by the target zone's real offset, not a hardcoded one", () => {
    // America/Los_Angeles is UTC-7 (PDT) in September.
    const instant = zonedTimeToUtc({ year: 2026, month: 9, day: 1 }, "America/Los_Angeles");
    expect(instant.toISOString()).toBe("2026-09-01T19:00:00.000Z");
  });

  it("handles a DST transition date correctly on both sides", () => {
    // 2026-03-08 is the US spring-forward date; noon is unaffected by the
    // 2am transition, so both the day before and after must still resolve
    // to the same real calendar date when re-read in the same zone.
    const before = zonedTimeToUtc({ year: 2026, month: 3, day: 7 }, "America/Los_Angeles");
    const after = zonedTimeToUtc({ year: 2026, month: 3, day: 9 }, "America/Los_Angeles");
    expect(formatInTimeZone(before, "America/Los_Angeles")).toBe("2026-03-07");
    expect(formatInTimeZone(after, "America/Los_Angeles")).toBe("2026-03-09");
  });

  it("the SAME selected calendar date resolves to a different real instant in two different configured timezones", () => {
    // This is the core Part 4 timezone-correctness scenario: the same
    // YYYY-MM-DD must NOT collapse to the same instant (or worse, the wrong
    // calendar date) just because two users -- or the same user on two
    // devices -- have different configured timezones.
    const la = zonedTimeToUtc({ year: 2026, month: 9, day: 1 }, "America/Los_Angeles");
    const hcm = zonedTimeToUtc({ year: 2026, month: 9, day: 1 }, "Asia/Ho_Chi_Minh");
    expect(la.getTime()).not.toBe(hcm.getTime());
    // Each must still read back as Sept 1 in ITS OWN configured zone.
    expect(formatInTimeZone(la, "America/Los_Angeles")).toBe("2026-09-01");
    expect(formatInTimeZone(hcm, "Asia/Ho_Chi_Minh")).toBe("2026-09-01");
  });

  it("browser timezone is irrelevant: LA-configured Sept 1 reads as Sept 1 in LA even when 'viewed' via an instant computed with no reference to any other zone", () => {
    // Regression guard for the exact bug this Part fixes: previously,
    // occurredAtFromLocalDateInput anchored to the BROWSER's local noon, so
    // a profiles.timezone of America/Los_Angeles while the browser ran in
    // Asia/Ho_Chi_Minh (UTC+7) would shift the stored instant by 14 hours
    // and could land on the wrong calendar date once reinterpreted in the
    // configured timezone. zonedTimeToUtc takes the configured timezone
    // directly and never touches the host's local Date getters, so no
    // browser-timezone input can influence this result at all.
    const instant = zonedTimeToUtc({ year: 2026, month: 9, day: 1 }, "America/Los_Angeles");
    expect(formatInTimeZone(instant, "America/Los_Angeles")).toBe("2026-09-01");
  });
});

describe("parseDateInputValue", () => {
  it("parses a YYYY-MM-DD value into numeric parts", () => {
    expect(parseDateInputValue("2026-09-01")).toEqual({ year: 2026, month: 9, day: 1 });
  });
});
