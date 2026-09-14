import { describe, it, expect } from "vitest";
import { buildActivityLabel } from "./transactionsAnalytics";
import type { TransactionsActivitySummaryResponse } from "./financialAggregates";

function summary(overrides: Partial<TransactionsActivitySummaryResponse> = {}): TransactionsActivitySummaryResponse {
  return {
    rangeStart: "2024-03-01T08:00:00.000Z",
    rangeEnd: "2024-03-11T08:00:00.000Z",
    previousRangeStart: "2024-02-01T08:00:00.000Z",
    previousRangeEnd: "2024-03-01T08:00:00.000Z",
    days: 10,
    previousDays: 29,
    isCustomRange: false,
    expenseAmount: 0,
    dailyRate: 0,
    previousDailyRate: null,
    changePercent: null,
    dailyBuckets: [],
    topCategories: [],
    ...overrides,
  };
}

describe("buildActivityLabel", () => {
  it("labels the default month-to-date period with an explicit suffix", () => {
    const label = buildActivityLabel(summary({ isCustomRange: false }));
    expect(label).toMatch(/\(month to date\)$/);
  });

  it("labels a single-day custom range with just that one date", () => {
    const label = buildActivityLabel(
      summary({
        isCustomRange: true,
        days: 1,
        rangeStart: "2024-03-05T08:00:00.000Z",
        rangeEnd: "2024-03-06T08:00:00.000Z",
      })
    );
    expect(label).not.toContain("–");
    expect(label).not.toContain("(month to date)");
  });

  it("labels a multi-day custom range as a real date span, using the inclusive last day (not the exclusive rangeEnd)", () => {
    const label = buildActivityLabel(
      summary({
        isCustomRange: true,
        days: 3,
        rangeStart: "2024-03-05T08:00:00.000Z",
        rangeEnd: "2024-03-08T08:00:00.000Z", // exclusive -- real last day is March 7
      })
    );
    expect(label).toContain("–");
    expect(label).not.toContain("(month to date)");
  });
});
