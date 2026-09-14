import { describe, it, expect } from "vitest";
import { formatDate } from "./dateFormat";

const LA = "America/Los_Angeles";
const HCM = "Asia/Ho_Chi_Minh";

describe("formatDate", () => {
  const instant = new Date("2025-10-24T19:00:00.000Z"); // noon PDT (LA, UTC-7 in October)

  it("mdy: MM/DD/YYYY", () => {
    expect(formatDate(instant, "mdy", LA)).toBe("10/24/2025");
  });

  it("dmy: DD/MM/YYYY", () => {
    expect(formatDate(instant, "dmy", LA)).toBe("24/10/2025");
  });

  it("ymd: YYYY-MM-DD", () => {
    expect(formatDate(instant, "ymd", LA)).toBe("2025-10-24");
  });

  it("zero-pads single-digit months and days", () => {
    const early = new Date("2025-01-06T20:00:00.000Z"); // Jan 6, noon PST
    expect(formatDate(early, "mdy", LA)).toBe("01/06/2025");
    expect(formatDate(early, "dmy", LA)).toBe("06/01/2025");
  });

  it("reads the calendar day in the given timezone, not the browser's own timezone (no browser-timezone regression)", () => {
    // 2025-01-06T02:30:00Z is Jan 5 in Los Angeles (UTC-8 in January) but
    // Jan 6 in Ho Chi Minh City (UTC+7) -- the same real instant must format
    // to a DIFFERENT calendar date depending only on the timeZone argument,
    // never on whatever timezone the test runner's host happens to be in.
    const instant2 = new Date("2025-01-06T02:30:00Z");
    expect(formatDate(instant2, "ymd", LA)).toBe("2025-01-05");
    expect(formatDate(instant2, "ymd", HCM)).toBe("2025-01-06");
  });

  it("defaults to mdy for an unrecognized/future format value", () => {
    // TypeScript prevents this at compile time, but the runtime default
    // branch is still real, reachable code -- verified directly here.
    expect(formatDate(instant, "unexpected" as never, LA)).toBe("10/24/2025");
  });
});
