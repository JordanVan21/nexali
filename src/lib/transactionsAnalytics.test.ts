import { describe, it, expect } from "vitest";
import type { TransactionWithCat } from "./transactions";
import { resolveBurnPeriod, computeDailyBurn, topExpenseCategories, dailyExpenseBuckets } from "./transactionsAnalytics";

const NOW = new Date(2024, 2, 10); // March 10, 2024 (leap year: Feb has 29 days)

const makeTx = (overrides: Partial<TransactionWithCat> & { categoryType?: "income" | "expense" } = {}): TransactionWithCat => {
  const { categoryType = "expense", ...rest } = overrides;
  return {
    id: Math.random(),
    amount: 10,
    merchant: "Test Merchant",
    note: null,
    created_at: NOW.toISOString(),
    occurred_at: NOW.toISOString(),
    category_id: 1,
    categories: { id: 1, name: "Groceries", type: categoryType },
    ...rest,
  };
};

describe("resolveBurnPeriod", () => {
  it("defaults to the current calendar month to date when no date filter is active", () => {
    const period = resolveBurnPeriod(undefined, undefined, NOW);

    expect(period.range.start).toEqual(new Date(2024, 2, 1));
    expect(period.days).toBe(10);
    expect(period.previousRange).toEqual({ start: new Date(2024, 1, 1), end: new Date(2024, 2, 1) });
    expect(period.previousDays).toBe(29); // Feb 2024 is a leap-year month
  });

  it("uses the user's active date range when one is set, with an equal-length previous window", () => {
    const period = resolveBurnPeriod("2024-03-05T00:00:00.000Z", "2024-03-07T00:00:00.000Z", NOW);

    expect(period.days).toBe(3);
    expect(period.previousDays).toBe(3);
  });
});

describe("computeDailyBurn", () => {
  it("excludes income and only counts real expense transactions", () => {
    const period = resolveBurnPeriod(undefined, undefined, NOW);
    const transactions = [
      makeTx({ amount: 30, occurred_at: new Date(2024, 2, 5).toISOString(), categoryType: "expense" }),
      makeTx({ amount: 5000, occurred_at: new Date(2024, 2, 5).toISOString(), categoryType: "income" }),
    ];

    const burn = computeDailyBurn(transactions, period);

    expect(burn.amount).toBe(30);
    expect(burn.dailyRate).toBeCloseTo(3); // 30 / 10 days
  });

  it("handles an empty transaction list without error", () => {
    const period = resolveBurnPeriod(undefined, undefined, NOW);
    const burn = computeDailyBurn([], period);

    expect(burn.amount).toBe(0);
    expect(burn.dailyRate).toBe(0);
    expect(burn.previousDailyRate).toBeNull();
    expect(burn.changePercent).toBeNull();
  });

  it("reports no previous-period data instead of a fabricated percentage when the previous period has no expenses", () => {
    const period = resolveBurnPeriod(undefined, undefined, NOW);
    const transactions = [makeTx({ amount: 100, occurred_at: new Date(2024, 2, 5).toISOString() })];

    const burn = computeDailyBurn(transactions, period);

    expect(burn.previousDailyRate).toBeNull();
    expect(burn.changePercent).toBeNull();
  });

  it("computes a real percent-change when a previous-period baseline exists", () => {
    const period = resolveBurnPeriod(undefined, undefined, NOW);
    const transactions = [
      makeTx({ amount: 290, occurred_at: new Date(2024, 2, 5).toISOString() }), // current month: 290 / 10 days = 29/day
      makeTx({ amount: 290, occurred_at: new Date(2024, 1, 5).toISOString() }), // previous month: 290 / 29 days = 10/day
    ];

    const burn = computeDailyBurn(transactions, period);

    expect(burn.dailyRate).toBeCloseTo(29);
    expect(burn.previousDailyRate).toBeCloseTo(10);
    expect(burn.changePercent).toBeCloseTo(190); // (29 - 10) / 10 * 100
  });
});

describe("topExpenseCategories", () => {
  it("excludes income and groups real expense transactions by real category", () => {
    const period = resolveBurnPeriod(undefined, undefined, NOW);
    const transactions = [
      makeTx({
        amount: 60,
        category_id: 1,
        categories: { id: 1, name: "Groceries", type: "expense" },
        occurred_at: new Date(2024, 2, 2).toISOString(),
      }),
      makeTx({
        amount: 40,
        category_id: 2,
        categories: { id: 2, name: "Dining", type: "expense" },
        occurred_at: new Date(2024, 2, 3).toISOString(),
      }),
      makeTx({
        amount: 500,
        category_id: 3,
        categories: { id: 3, name: "Salary", type: "income" },
        occurred_at: new Date(2024, 2, 3).toISOString(),
      }),
    ];

    const categories = topExpenseCategories(transactions, period);

    expect(categories.map((c) => c.label)).toEqual(["Groceries", "Dining"]);
    expect(categories.find((c) => c.label === "Groceries")?.percent).toBeCloseTo(60);
    expect(categories.some((c) => c.label === "Salary")).toBe(false);
  });

  it("never invents Lovable's mock category groupings", () => {
    const period = resolveBurnPeriod(undefined, undefined, NOW);
    const categories = topExpenseCategories(
      [makeTx({ amount: 20, categories: { id: 1, name: "Groceries", type: "expense" } })],
      period
    );

    const labels = categories.map((c) => c.label);
    expect(labels).not.toContain("Essentials");
    expect(labels).not.toContain("Lifestyle & Dining");
    expect(labels).not.toContain("Investments & Savings");
  });
});

describe("dailyExpenseBuckets", () => {
  it("reports a real zero for days with no expenses instead of omitting them", () => {
    const period = resolveBurnPeriod(undefined, undefined, NOW);
    const buckets = dailyExpenseBuckets([], period);

    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.every((b) => b.amount === 0)).toBe(true);
  });
});
