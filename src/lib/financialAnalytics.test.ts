import { describe, it, expect } from "vitest";
import {
  sumIncomeExpense,
  rangeForLastNMonths,
  previousEquivalentRange,
  buildMonthlyBuckets,
  expenseCategoryTotals,
  savingsRate,
} from "./financialAnalytics";
import { monthRange } from "./financialPeriods";
import type { TransactionWithCat } from "./transactions";

const NOW = new Date(2025, 5, 15); // June 15, 2025

function tx(overrides: Partial<TransactionWithCat> & { occurred_at: string }): TransactionWithCat {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 1_000_000),
    amount: 0,
    merchant: null,
    note: null,
    category_id: 1,
    created_at: "2099-01-01T00:00:00Z",
    categories: { id: 1, name: "Groceries", type: "expense" },
    ...overrides,
  };
}

describe("sumIncomeExpense", () => {
  it("sums income and expenses within the range only, excluding income from expenses", () => {
    const range = monthRange(2025, 5);
    const transactions: TransactionWithCat[] = [
      tx({ amount: 3000, occurred_at: "2025-06-01T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } }),
      tx({ amount: 200, occurred_at: "2025-06-05T12:00:00Z" }),
      tx({ amount: 9999, occurred_at: "2025-05-15T12:00:00Z" }), // outside range
    ];

    const totals = sumIncomeExpense(transactions, range);
    expect(totals).toEqual({ income: 3000, expenses: 200, net: 2800 });
  });

  it("returns all zeros for an empty transaction list", () => {
    expect(sumIncomeExpense([], monthRange(2025, 5))).toEqual({ income: 0, expenses: 0, net: 0 });
  });
});

describe("rangeForLastNMonths", () => {
  it("spans exactly N months ending with the current month", () => {
    const range = rangeForLastNMonths(3, NOW);
    expect(range.start).toEqual(new Date(2025, 3, 1)); // April 1
    expect(range.end).toEqual(new Date(2025, 6, 1)); // July 1 (exclusive)
  });

  it("spans a single month when N is 1", () => {
    const range = rangeForLastNMonths(1, NOW);
    expect(range.start).toEqual(new Date(2025, 5, 1));
    expect(range.end).toEqual(new Date(2025, 6, 1));
  });
});

describe("previousEquivalentRange", () => {
  it("returns the immediately preceding window of the same length", () => {
    const current = rangeForLastNMonths(3, NOW); // Apr 1 - Jul 1
    const previous = previousEquivalentRange(current, 3);
    expect(previous.start).toEqual(new Date(2025, 0, 1)); // Jan 1
    expect(previous.end).toEqual(new Date(2025, 3, 1)); // Apr 1 (= current.start)
  });

  it("rolls over the year boundary correctly", () => {
    const current = rangeForLastNMonths(1, new Date(2025, 0, 15)); // Jan 2025
    const previous = previousEquivalentRange(current, 1);
    expect(previous.start).toEqual(new Date(2024, 11, 1)); // Dec 2024
    expect(previous.end).toEqual(new Date(2025, 0, 1));
  });
});

describe("buildMonthlyBuckets", () => {
  it("builds the requested number of buckets, oldest to newest, labeled by month", () => {
    const transactions: TransactionWithCat[] = [
      tx({ amount: 500, occurred_at: "2025-06-02T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } }),
      tx({ amount: 100, occurred_at: "2025-05-02T12:00:00Z" }),
    ];

    const buckets = buildMonthlyBuckets(transactions, 3, NOW);

    expect(buckets.map((b) => b.month)).toEqual(["Apr", "May", "Jun"]);
    expect(buckets[0]).toEqual({ month: "Apr", income: 0, expenses: 0 });
    expect(buckets[1]).toEqual({ month: "May", income: 0, expenses: 100 });
    expect(buckets[2]).toEqual({ month: "Jun", income: 500, expenses: 0 });
  });
});

describe("expenseCategoryTotals", () => {
  const range = monthRange(2025, 5);

  it("groups real expense transactions by category with amount, count, and percent of the range total", () => {
    const transactions: TransactionWithCat[] = [
      tx({ amount: 300, occurred_at: "2025-06-01T12:00:00Z", category_id: 1, categories: { id: 1, name: "Housing", type: "expense" } }),
      tx({ amount: 100, occurred_at: "2025-06-02T12:00:00Z", category_id: 2, categories: { id: 2, name: "Dining", type: "expense" } }),
      tx({ amount: 100, occurred_at: "2025-06-03T12:00:00Z", category_id: 2, categories: { id: 2, name: "Dining", type: "expense" } }),
    ];

    const totals = expenseCategoryTotals(transactions, range);

    expect(totals).toEqual([
      { id: 1, label: "Housing", amount: 300, count: 1, percent: 60 },
      { id: 2, label: "Dining", amount: 200, count: 2, percent: 40 },
    ]);
  });

  it("excludes income transactions from the spending breakdown", () => {
    const transactions: TransactionWithCat[] = [
      tx({ amount: 5000, occurred_at: "2025-06-01T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } }),
      tx({ amount: 100, occurred_at: "2025-06-02T12:00:00Z" }),
    ];

    const totals = expenseCategoryTotals(transactions, range);
    expect(totals).toEqual([{ id: 1, label: "Groceries", amount: 100, count: 1, percent: 100 }]);
  });

  it("breaks ties deterministically by category name", () => {
    const transactions: TransactionWithCat[] = [
      tx({ amount: 100, occurred_at: "2025-06-01T12:00:00Z", category_id: 2, categories: { id: 2, name: "Zebra", type: "expense" } }),
      tx({ amount: 100, occurred_at: "2025-06-01T12:00:00Z", category_id: 1, categories: { id: 1, name: "Apple", type: "expense" } }),
    ];

    const totals = expenseCategoryTotals(transactions, range);
    expect(totals.map((t) => t.label)).toEqual(["Apple", "Zebra"]);
  });

  it("does not divide by zero and returns an empty list when there are no expenses in the range", () => {
    expect(expenseCategoryTotals([], range)).toEqual([]);
  });

  it("filters to a single category when categoryName is given", () => {
    const transactions: TransactionWithCat[] = [
      tx({ amount: 300, occurred_at: "2025-06-01T12:00:00Z", category_id: 1, categories: { id: 1, name: "Housing", type: "expense" } }),
      tx({ amount: 100, occurred_at: "2025-06-02T12:00:00Z", category_id: 2, categories: { id: 2, name: "Dining", type: "expense" } }),
    ];

    const totals = expenseCategoryTotals(transactions, range, { categoryName: "Dining" });
    expect(totals).toEqual([{ id: 2, label: "Dining", amount: 100, count: 1, percent: 25 }]);
  });

  it("respects topN after sorting by amount descending", () => {
    const transactions: TransactionWithCat[] = [
      tx({ amount: 300, occurred_at: "2025-06-01T12:00:00Z", category_id: 1, categories: { id: 1, name: "Housing", type: "expense" } }),
      tx({ amount: 200, occurred_at: "2025-06-02T12:00:00Z", category_id: 2, categories: { id: 2, name: "Dining", type: "expense" } }),
      tx({ amount: 100, occurred_at: "2025-06-03T12:00:00Z", category_id: 3, categories: { id: 3, name: "Fuel", type: "expense" } }),
    ];

    const totals = expenseCategoryTotals(transactions, range, { topN: 2 });
    expect(totals.map((t) => t.label)).toEqual(["Housing", "Dining"]);
  });
});

describe("savingsRate", () => {
  it("computes (income - expenses) / income * 100", () => {
    expect(savingsRate(1000, 600)).toBe(40);
  });

  it("can be negative when expenses exceed income", () => {
    expect(savingsRate(1000, 1500)).toBe(-50);
  });

  it("returns null instead of Infinity/NaN when income is 0", () => {
    expect(savingsRate(0, 100)).toBeNull();
  });
});
