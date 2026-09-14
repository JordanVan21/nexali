import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useReportsData, ALL_CATEGORIES } from "./useReportsData";
import type { TransactionWithCat } from "../../lib/transactions";
import type { Budget } from "../../lib/budgets";

const NOW = new Date(2025, 5, 15); // June 15, 2025

let txState: { data?: TransactionWithCat[]; isLoading: boolean; isError: boolean };
let budgetsState: { data?: Budget[]; isLoading: boolean; isError: boolean };

vi.mock("../transactions/useTransactions", () => ({
  useTransactions: () => ({ ...txState, refetch: vi.fn() }),
}));

vi.mock("../budgets/useBudgets", () => ({
  useBudgets: () => ({ ...budgetsState, refetch: vi.fn() }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

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

describe("useReportsData", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("computes real income/expenses/net for the selected period only", () => {
    txState = {
      data: [
        tx({ amount: 3000, occurred_at: "2025-06-01T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } }),
        tx({ amount: 200, occurred_at: "2025-06-05T12:00:00Z" }),
        tx({ amount: 9999, occurred_at: "2024-01-05T12:00:00Z" }), // well outside any tested period
      ],
      isLoading: false,
      isError: false,
    };
    budgetsState = { data: [], isLoading: false, isError: false };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES, NOW), { wrapper });

    expect(result.current.totals).toEqual({ income: 3000, expenses: 200, net: 2800 });
  });

  it("changing the period changes the computed totals", () => {
    txState = {
      data: [
        tx({ amount: 100, occurred_at: "2025-06-05T12:00:00Z" }), // this month
        tx({ amount: 50, occurred_at: "2025-04-05T12:00:00Z" }), // 3 months back, not 1
      ],
      isLoading: false,
      isError: false,
    };
    budgetsState = { data: [], isLoading: false, isError: false };

    const { result: oneMonth } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES, NOW), { wrapper });
    expect(oneMonth.current.totals.expenses).toBe(100);

    const { result: threeMonths } = renderHook(() => useReportsData("u1", 3, ALL_CATEGORIES, NOW), { wrapper });
    expect(threeMonths.current.totals.expenses).toBe(150);
  });

  it("computes the previous equivalent-length period for comparison", () => {
    txState = {
      data: [
        tx({ amount: 100, occurred_at: "2025-06-05T12:00:00Z" }), // in the 1-month window
        tx({ amount: 40, occurred_at: "2025-05-05T12:00:00Z" }), // in the previous 1-month window
      ],
      isLoading: false,
      isError: false,
    };
    budgetsState = { data: [], isLoading: false, isError: false };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES, NOW), { wrapper });
    expect(result.current.totals.expenses).toBe(100);
    expect(result.current.previousTotals).toEqual({ income: 0, expenses: 40, net: -40 });
  });

  it("does not report a fake previous-period total while transactions are still loading", () => {
    txState = { data: undefined, isLoading: true, isError: false };
    budgetsState = { data: [], isLoading: false, isError: false };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES, NOW), { wrapper });
    expect(result.current.previousTotals).toBeNull();
  });

  it("computes a real, guarded savings rate", () => {
    txState = {
      data: [
        tx({ amount: 1000, occurred_at: "2025-06-01T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } }),
        tx({ amount: 600, occurred_at: "2025-06-05T12:00:00Z" }),
      ],
      isLoading: false,
      isError: false,
    };
    budgetsState = { data: [], isLoading: false, isError: false };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES, NOW), { wrapper });
    expect(result.current.savingsRatePercent).toBe(40);
  });

  it("returns null savings rate instead of Infinity/NaN when there is no income in the period", () => {
    txState = { data: [tx({ amount: 100, occurred_at: "2025-06-05T12:00:00Z" })], isLoading: false, isError: false };
    budgetsState = { data: [], isLoading: false, isError: false };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES, NOW), { wrapper });
    expect(result.current.savingsRatePercent).toBeNull();
  });

  it("filters category totals by the selected category, excluding income", () => {
    txState = {
      data: [
        tx({ amount: 300, occurred_at: "2025-06-01T12:00:00Z", category_id: 1, categories: { id: 1, name: "Housing", type: "expense" } }),
        tx({ amount: 100, occurred_at: "2025-06-02T12:00:00Z", category_id: 2, categories: { id: 2, name: "Dining", type: "expense" } }),
        tx({ amount: 5000, occurred_at: "2025-06-03T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } }),
      ],
      isLoading: false,
      isError: false,
    };
    budgetsState = { data: [], isLoading: false, isError: false };

    const all = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES, NOW), { wrapper });
    expect(all.result.current.categoryTotals.map((c) => c.label)).toEqual(["Housing", "Dining"]);

    const dining = renderHook(() => useReportsData("u1", 1, "Dining", NOW), { wrapper });
    expect(dining.result.current.categoryTotals.map((c) => c.label)).toEqual(["Dining"]);
  });

  it("only includes budgets whose month/year falls in the selected range", () => {
    txState = { data: [], isLoading: false, isError: false };
    budgetsState = {
      data: [
        { id: 1, amount: 200, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
        { id: 2, amount: 200, month: 1, year: 2024, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
      ],
      isLoading: false,
      isError: false,
    };

    const { result } = renderHook(() => useReportsData("u1", 3, ALL_CATEGORIES, NOW), { wrapper });
    expect(result.current.budgetsInRange).toHaveLength(1);
    expect(result.current.budgetsInRange[0].id).toBe(1);
  });

  it("does not synthesize budget rows while transaction data (needed for real spend) has not loaded", () => {
    txState = { data: undefined, isLoading: true, isError: false };
    budgetsState = {
      data: [{ id: 1, amount: 200, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } }],
      isLoading: false,
      isError: false,
    };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES, NOW), { wrapper });
    expect(result.current.budgetsInRange).toHaveLength(0);
  });

  it("builds the real category filter list from expense categories actually present in the data", () => {
    txState = {
      data: [
        tx({ amount: 10, occurred_at: "2025-06-01T12:00:00Z", categories: { id: 1, name: "Zebra", type: "expense" } }),
        tx({ amount: 10, occurred_at: "2025-06-01T12:00:00Z", categories: { id: 2, name: "Apple", type: "expense" } }),
        tx({ amount: 10, occurred_at: "2025-06-01T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } }),
      ],
      isLoading: false,
      isError: false,
    };
    budgetsState = { data: [], isLoading: false, isError: false };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES, NOW), { wrapper });
    expect(result.current.categoryNames).toEqual(["All Categories", "Apple", "Zebra"]);
  });
});
