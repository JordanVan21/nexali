import { describe, it, expect } from "vitest";
import { toZonedDateInputValue, occurredAtFromZonedDateInput } from "./transactionDate";

const LA = "America/Los_Angeles";
const HCM = "Asia/Ho_Chi_Minh";

describe("toZonedDateInputValue", () => {
  it("formats as YYYY-MM-DD using the given timezone's calendar, not the host's", () => {
    // 2025-01-06T02:30:00Z is Jan 5, 11:30pm in Los Angeles (UTC-8 in
    // January) but Jan 6, 9:30am in Ho Chi Minh City (UTC+7) -- the same
    // instant must format to a different calendar date per zone.
    const instant = new Date("2025-01-06T02:30:00Z");
    expect(toZonedDateInputValue(instant, LA)).toBe("2025-01-05");
    expect(toZonedDateInputValue(instant, HCM)).toBe("2025-01-06");
  });

  it("zero-pads single-digit months and days", () => {
    const instant = new Date("2025-03-04T12:00:00Z");
    expect(toZonedDateInputValue(instant, "UTC")).toBe("2025-03-04");
  });
});

describe("occurredAtFromZonedDateInput", () => {
  it("produces a real, parseable ISO timestamp that reads back as the given calendar date in the same zone", () => {
    const iso = occurredAtFromZonedDateInput("2025-06-15", LA);
    expect(toZonedDateInputValue(new Date(iso), LA)).toBe("2025-06-15");
  });

  it("round-trips through toZonedDateInputValue back to the same calendar date", () => {
    const original = "2025-12-31";
    const iso = occurredAtFromZonedDateInput(original, LA);
    expect(toZonedDateInputValue(new Date(iso), LA)).toBe(original);
  });

  it("the configured timezone determines the stored calendar date, independent of any other zone", () => {
    // The core Part 4 scenario: profiles.timezone = America/Los_Angeles,
    // but the value picked while physically in (or with a machine clock
    // set to) Asia/Ho_Chi_Minh must still represent Sept 1 in the
    // CONFIGURED (Los Angeles) timezone, since that's the canonical
    // financial timezone -- not wherever the browser happens to be.
    const iso = occurredAtFromZonedDateInput("2026-09-01", LA);
    expect(toZonedDateInputValue(new Date(iso), LA)).toBe("2026-09-01");
    // And it must NOT necessarily read as Sept 1 in a different zone --
    // this stored instant genuinely represents "Sept 1, noon, Los Angeles
    // time" and nothing else.
    expect(new Date(iso).toISOString()).toBe("2026-09-01T19:00:00.000Z");
  });

  it("two different configured timezones produce two different real instants for the same picked date", () => {
    const laIso = occurredAtFromZonedDateInput("2026-09-01", LA);
    const hcmIso = occurredAtFromZonedDateInput("2026-09-01", HCM);
    expect(laIso).not.toBe(hcmIso);
  });
});
