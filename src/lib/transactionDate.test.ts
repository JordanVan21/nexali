import { describe, it, expect } from "vitest";
import { toLocalDateInputValue, occurredAtFromLocalDateInput } from "./transactionDate";

describe("toLocalDateInputValue", () => {
  it("formats as YYYY-MM-DD using the date's local calendar fields, not UTC", () => {
    // Deliberately a date/time that would show a different calendar day if
    // read via toISOString() (UTC) than via local getters, on most real
    // timezones -- this pins the function to local-calendar behavior.
    const date = new Date(2025, 0, 5, 23, 30); // Jan 5, 2025, 11:30pm local
    expect(toLocalDateInputValue(date)).toBe("2025-01-05");
  });

  it("zero-pads single-digit months and days", () => {
    const date = new Date(2025, 2, 4); // March 4, 2025 (month=2 is March, 0-based)
    expect(toLocalDateInputValue(date)).toBe("2025-03-04");
  });
});

describe("occurredAtFromLocalDateInput", () => {
  it("produces a real, parseable ISO timestamp for the given local calendar date", () => {
    const iso = occurredAtFromLocalDateInput("2025-06-15");
    const parsed = new Date(iso);
    expect(parsed.getFullYear()).toBe(2025);
    expect(parsed.getMonth()).toBe(5); // June, 0-based
    expect(parsed.getDate()).toBe(15);
  });

  it("stores local noon, not local midnight, so the calendar date can't shift under any real-world timezone offset", () => {
    const iso = occurredAtFromLocalDateInput("2025-06-15");
    const parsed = new Date(iso);
    expect(parsed.getHours()).toBe(12);
    expect(parsed.getMinutes()).toBe(0);
  });

  it("round-trips through toLocalDateInputValue back to the same calendar date", () => {
    const original = "2025-12-31";
    const iso = occurredAtFromLocalDateInput(original);
    expect(toLocalDateInputValue(new Date(iso))).toBe(original);
  });
});
