import { describe, it, expect } from "vitest";
import { mapDashboardSummary, percentChange } from "./dashboardMath";
import type { Budget } from "../../lib/budgets";
import type { DashboardSummaryResponse, BudgetsProgressRow } from "../../lib/financialAggregates";

function raw(overrides: Partial<DashboardSummaryResponse> = {}): DashboardSummaryResponse {
  return {
    month: { income: 0, expenses: 0, net: 0 },
    prevMonth: { income: 0, expenses: 0 },
    cashflow: [],
    categoryBreakdown: [],
    recentTransactions: [],
    currentYear: 2025,
    currentMonth: 6,
    ...overrides,
  };
}

describe("mapDashboardSummary", () => {
  it("passes the server-computed month totals through unchanged", () => {
    const summary = mapDashboardSummary(raw({ month: { income: 3000, expenses: 200, net: 2800 } }), [], []);
    expect(summary.month).toEqual({ income: 3000, expenses: 200, net: 2800 });
  });

  it("passes prevMonth totals through unchanged", () => {
    const summary = mapDashboardSummary(raw({ prevMonth: { income: 100, expenses: 50 } }), [], []);
    expect(summary.prevMonth).toEqual({ income: 100, expenses: 50 });
  });

  it("formats cashflow month labels from year/month using the locale-aware short month name", () => {
    const summary = mapDashboardSummary(
      raw({
        cashflow: [
          { year: 2025, month: 4, income: 0, expenses: 0 },
          { year: 2025, month: 5, income: 0, expenses: 0 },
          { year: 2025, month: 6, income: 500, expenses: 0 },
        ],
      }),
      [],
      []
    );
    expect(summary.cashflow.map((p) => p.month)).toEqual(["Apr", "May", "Jun"]);
    expect(summary.cashflow[2].income).toBe(500);
  });

  it("passes categoryBreakdown through unchanged", () => {
    const breakdown = [
      { id: 1, label: "Housing", amount: 300, percent: 60 },
      { id: 2, label: "Dining", amount: 200, percent: 40 },
    ];
    const summary = mapDashboardSummary(raw({ categoryBreakdown: breakdown }), [], []);
    expect(summary.categoryBreakdown).toEqual(breakdown);
  });

  it("only includes budgets matching the reference month/year (already filtered by the caller)", () => {
    const budgets: Budget[] = [
      { id: 1, amount: 500, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
    ];
    const summary = mapDashboardSummary(raw(), budgets, []);
    expect(summary.budgets).toHaveLength(1);
    expect(summary.budgets[0].id).toBe(1);
  });

  it("joins server spend rows onto the matching budget by category id", () => {
    const budgets: Budget[] = [
      { id: 1, amount: 200, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
    ];
    const spend: BudgetsProgressRow[] = [{ categoryId: 1, spent: 150 }];
    const summary = mapDashboardSummary(raw(), budgets, spend);
    expect(summary.budgets[0].spent).toBe(150);
    expect(summary.budgets[0].percent).toBe(75);
  });

  it("defaults a budget's spend to 0 when the server returns no matching row", () => {
    const budgets: Budget[] = [
      { id: 1, amount: 200, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
    ];
    const summary = mapDashboardSummary(raw(), budgets, []);
    expect(summary.budgets[0].spent).toBe(0);
  });

  it("tones budgets success/warning/destructive at the 75%/95% thresholds", () => {
    const budgetAt = (): Budget[] => [
      { id: 1, amount: 100, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
    ];
    expect(mapDashboardSummary(raw(), budgetAt(), [{ categoryId: 1, spent: 50 }]).budgets[0].tone).toBe("success");
    expect(mapDashboardSummary(raw(), budgetAt(), [{ categoryId: 1, spent: 80 }]).budgets[0].tone).toBe("warning");
    expect(mapDashboardSummary(raw(), budgetAt(), [{ categoryId: 1, spent: 96 }]).budgets[0].tone).toBe("destructive");
  });

  it("counts warnings as budgets at or above the warning threshold", () => {
    const budgets: Budget[] = [
      { id: 1, amount: 100, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "A", type: "expense" } },
      { id: 2, amount: 100, month: 6, year: 2025, category_id: 2, categories: { id: 2, name: "B", type: "expense" } },
    ];
    const spend: BudgetsProgressRow[] = [
      { categoryId: 1, spent: 10 }, // success
      { categoryId: 2, spent: 90 }, // warning
    ];
    const summary = mapDashboardSummary(raw(), budgets, spend);
    expect(summary.warningsCount).toBe(1);
  });

  it("does not divide by zero when a budget limit is 0", () => {
    const budgets: Budget[] = [
      { id: 1, amount: 0, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "A", type: "expense" } },
    ];
    const summary = mapDashboardSummary(raw(), budgets, []);
    expect(summary.budgets[0].percent).toBe(0);
    expect(summary.budgets[0].tone).toBe("success");
  });

  it("passes recentTransactions through unchanged -- ordering/limiting is the server's responsibility", () => {
    const recent = [
      { id: 3, amount: 30, merchant: null, note: null, created_at: null, occurred_at: "2025-06-12T12:00:00Z", category_id: 1, categories: null },
    ];
    const summary = mapDashboardSummary(raw({ recentTransactions: recent }), [], []);
    expect(summary.recentTransactions).toEqual(recent);
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
