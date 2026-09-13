import { describe, it, expect } from "vitest";
import { computeDashboardSummary, percentChange } from "./dashboardMath";
import type { TransactionWithCat } from "../../lib/transactions";
import type { Budget } from "../../lib/budgets";

// Reference "now" so every test is independent of the actual calendar date.
const NOW = new Date(2025, 5, 15); // June 15, 2025

function tx(overrides: Partial<TransactionWithCat> & { created_at: string }): TransactionWithCat {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 1_000_000),
    amount: 0,
    merchant: null,
    note: null,
    category_id: 1,
    categories: { id: 1, name: "Groceries", type: "expense" },
    ...overrides,
  };
}

describe("computeDashboardSummary", () => {
  it("sums only this-month income and expenses into month.income/expenses/net", () => {
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 3000, created_at: "2025-06-01T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } }),
      tx({ id: 2, amount: 200, created_at: "2025-06-10T12:00:00Z", categories: { id: 1, name: "Groceries", type: "expense" } }),
      // Outside the current month — must not be counted.
      tx({ id: 3, amount: 9999, created_at: "2025-05-15T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } }),
      tx({ id: 4, amount: 9999, created_at: "2025-07-15T12:00:00Z", categories: { id: 1, name: "Groceries", type: "expense" } }),
    ];

    const summary = computeDashboardSummary(transactions, [], { now: NOW });

    expect(summary.month.income).toBe(3000);
    expect(summary.month.expenses).toBe(200);
    expect(summary.month.net).toBe(2800);
  });

  it("computes the previous calendar month separately from the current one", () => {
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 100, created_at: "2025-05-05T12:00:00Z", categories: { id: 1, name: "Groceries", type: "expense" } }),
      tx({ id: 2, amount: 50, created_at: "2025-06-05T12:00:00Z", categories: { id: 1, name: "Groceries", type: "expense" } }),
    ];

    const summary = computeDashboardSummary(transactions, [], { now: NOW });

    expect(summary.prevMonth.expenses).toBe(100);
    expect(summary.month.expenses).toBe(50);
  });

  it("builds a cashflow series of the requested length, oldest to newest, ending on the current month", () => {
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 500, created_at: "2025-06-02T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } }),
    ];

    const summary = computeDashboardSummary(transactions, [], { now: NOW, cashflowMonths: 3 });

    expect(summary.cashflow).toHaveLength(3);
    expect(summary.cashflow.map((p) => p.month)).toEqual(["Apr", "May", "Jun"]);
    expect(summary.cashflow[2].income).toBe(500);
    expect(summary.cashflow[0].income).toBe(0);
  });

  it("ranks this month's expense categories by amount and computes their share of total expenses", () => {
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 300, created_at: "2025-06-01T12:00:00Z", category_id: 1, categories: { id: 1, name: "Housing", type: "expense" } }),
      tx({ id: 2, amount: 100, created_at: "2025-06-02T12:00:00Z", category_id: 2, categories: { id: 2, name: "Dining", type: "expense" } }),
      // A second Dining transaction should merge into the same slice.
      tx({ id: 3, amount: 100, created_at: "2025-06-03T12:00:00Z", category_id: 2, categories: { id: 2, name: "Dining", type: "expense" } }),
    ];

    const summary = computeDashboardSummary(transactions, [], { now: NOW });

    expect(summary.categoryBreakdown).toEqual([
      { id: 1, label: "Housing", amount: 300, percent: 60 },
      { id: 2, label: "Dining", amount: 200, percent: 40 },
    ]);
  });

  it("returns an empty category breakdown when there is no expense data this month", () => {
    const summary = computeDashboardSummary([], [], { now: NOW });
    expect(summary.categoryBreakdown).toEqual([]);
  });

  it("returns the most recent transactions overall, not limited to this month", () => {
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 10, created_at: "2025-01-01T12:00:00Z" }),
      tx({ id: 2, amount: 20, created_at: "2025-06-10T12:00:00Z" }),
      tx({ id: 3, amount: 30, created_at: "2025-06-12T12:00:00Z" }),
    ];

    const summary = computeDashboardSummary(transactions, [], { now: NOW, recentCount: 2 });

    expect(summary.recentTransactions.map((t) => t.id)).toEqual([3, 2]);
  });

  it("only includes budgets matching the reference month and year", () => {
    const budgets: Budget[] = [
      { id: 1, amount: 500, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
      { id: 2, amount: 500, month: 5, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
    ];

    const summary = computeDashboardSummary([], budgets, { now: NOW });

    expect(summary.budgets).toHaveLength(1);
    expect(summary.budgets[0].id).toBe(1);
  });

  it("computes budget spend from this month's transactions in that category only", () => {
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 100, created_at: "2025-06-01T12:00:00Z", category_id: 1 }),
      tx({ id: 2, amount: 50, created_at: "2025-06-02T12:00:00Z", category_id: 1 }),
      // Different category — must not count toward this budget.
      tx({ id: 3, amount: 999, created_at: "2025-06-03T12:00:00Z", category_id: 2, categories: { id: 2, name: "Other", type: "expense" } }),
    ];
    const budgets: Budget[] = [
      { id: 1, amount: 200, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
    ];

    const summary = computeDashboardSummary(transactions, budgets, { now: NOW });

    expect(summary.budgets[0].spent).toBe(150);
    expect(summary.budgets[0].percent).toBe(75);
  });

  it("tones budgets success/warning/destructive at the 75%/95% thresholds", () => {
    const budgetAt = (): Budget[] => [
      { id: 1, amount: 100, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
    ];
    const txAt = (spent: number): TransactionWithCat[] => [
      tx({ id: 1, amount: spent, created_at: "2025-06-01T12:00:00Z", category_id: 1 }),
    ];

    expect(computeDashboardSummary(txAt(50), budgetAt(), { now: NOW }).budgets[0].tone).toBe("success");
    expect(computeDashboardSummary(txAt(80), budgetAt(), { now: NOW }).budgets[0].tone).toBe("warning");
    expect(computeDashboardSummary(txAt(96), budgetAt(), { now: NOW }).budgets[0].tone).toBe("destructive");
  });

  it("counts warnings as budgets at or above the warning threshold", () => {
    const budgets: Budget[] = [
      { id: 1, amount: 100, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "A", type: "expense" } },
      { id: 2, amount: 100, month: 6, year: 2025, category_id: 2, categories: { id: 2, name: "B", type: "expense" } },
    ];
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 10, created_at: "2025-06-01T12:00:00Z", category_id: 1 }), // 10% - success
      tx({ id: 2, amount: 90, created_at: "2025-06-01T12:00:00Z", category_id: 2 }), // 90% - warning
    ];

    const summary = computeDashboardSummary(transactions, budgets, { now: NOW });
    expect(summary.warningsCount).toBe(1);
  });

  it("does not divide by zero when a budget limit is 0", () => {
    const budgets: Budget[] = [
      { id: 1, amount: 0, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "A", type: "expense" } },
    ];
    const summary = computeDashboardSummary([], budgets, { now: NOW });
    expect(summary.budgets[0].percent).toBe(0);
    expect(summary.budgets[0].tone).toBe("success");
  });
});

describe("percentChange", () => {
  it("computes a positive percent change", () => {
    expect(percentChange(150, 100)).toBe(50);
  });

  it("computes a negative percent change", () => {
    expect(percentChange(50, 100)).toBe(-50);
  });

  it("returns null instead of a misleading percentage when there is no prior baseline", () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});
