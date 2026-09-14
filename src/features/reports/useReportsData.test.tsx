import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useReportsData, ALL_CATEGORIES } from "./useReportsData";
import type { Budget } from "../../lib/budgets";
import type { ReportsSummaryResponse } from "../../lib/financialAggregates";
import type { TransactionWithCat } from "../../lib/transactions";

let summaryState: { data?: ReportsSummaryResponse; isLoading: boolean; isError: boolean };
let budgetsState: { data?: Budget[]; isLoading: boolean; isError: boolean };
let exportState: { data?: TransactionWithCat[] };

vi.mock("./useReportsSummary", () => ({
  useReportsSummary: () => ({ ...summaryState, refetch: vi.fn() }),
}));

vi.mock("../budgets/useBudgets", () => ({
  useBudgets: () => ({ ...budgetsState, refetch: vi.fn() }),
}));

vi.mock("../transactions/useTransactions", () => ({
  useExportTransactionsWithFilters: () => ({ data: exportState.data, isLoading: false, isError: false }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function summary(overrides: Partial<ReportsSummaryResponse> = {}): ReportsSummaryResponse {
  return {
    totals: { income: 0, expenses: 0, net: 0 },
    previousTotals: { income: 0, expenses: 0, net: 0 },
    monthlyBuckets: [],
    categoryTotals: [],
    previousCategoryTotals: [],
    categoryNames: [],
    budgetsInRange: [],
    rangeStart: "2025-06-01T00:00:00.000Z",
    rangeEnd: "2025-07-01T00:00:00.000Z",
    hasAnyTransactionsEver: true,
    ...overrides,
  };
}

describe("useReportsData", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes the server-computed totals through for the selected period", () => {
    summaryState = { data: summary({ totals: { income: 3000, expenses: 200, net: 2800 } }), isLoading: false, isError: false };
    budgetsState = { data: [], isLoading: false, isError: false };
    exportState = { data: [] };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES), { wrapper });

    expect(result.current.totals).toEqual({ income: 3000, expenses: 200, net: 2800 });
  });

  it("passes the server-computed previous-period totals through", () => {
    summaryState = { data: summary({ previousTotals: { income: 0, expenses: 40, net: -40 } }), isLoading: false, isError: false };
    budgetsState = { data: [], isLoading: false, isError: false };
    exportState = { data: [] };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES), { wrapper });
    expect(result.current.previousTotals).toEqual({ income: 0, expenses: 40, net: -40 });
  });

  it("does not report a fake previous-period total while the summary is still loading", () => {
    summaryState = { data: undefined, isLoading: true, isError: false };
    budgetsState = { data: [], isLoading: false, isError: false };
    exportState = { data: undefined };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES), { wrapper });
    expect(result.current.previousTotals).toBeNull();
  });

  it("computes a real, guarded savings rate from the server totals", () => {
    summaryState = { data: summary({ totals: { income: 1000, expenses: 600, net: 400 } }), isLoading: false, isError: false };
    budgetsState = { data: [], isLoading: false, isError: false };
    exportState = { data: [] };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES), { wrapper });
    expect(result.current.savingsRatePercent).toBe(40);
  });

  it("returns null savings rate instead of Infinity/NaN when there is no income in the period", () => {
    summaryState = { data: summary({ totals: { income: 0, expenses: 100, net: -100 } }), isLoading: false, isError: false };
    budgetsState = { data: [], isLoading: false, isError: false };
    exportState = { data: [] };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES), { wrapper });
    expect(result.current.savingsRatePercent).toBeNull();
  });

  it("formats monthly bucket labels from the server's year/month pairs", () => {
    summaryState = {
      data: summary({
        monthlyBuckets: [
          { year: 2025, month: 4, income: 0, expenses: 0 },
          { year: 2025, month: 5, income: 0, expenses: 100 },
          { year: 2025, month: 6, income: 500, expenses: 0 },
        ],
      }),
      isLoading: false,
      isError: false,
    };
    budgetsState = { data: [], isLoading: false, isError: false };
    exportState = { data: [] };

    const { result } = renderHook(() => useReportsData("u1", 3, ALL_CATEGORIES), { wrapper });
    expect(result.current.monthlyBuckets.map((b) => b.month)).toEqual(["Apr", "May", "Jun"]);
    expect(result.current.monthlyBuckets[2].income).toBe(500);
  });

  it("passes server-computed category totals through for the selected category filter", () => {
    summaryState = {
      data: summary({ categoryTotals: [{ id: 2, label: "Dining", amount: 100, count: 1, percent: 25 }] }),
      isLoading: false,
      isError: false,
    };
    budgetsState = { data: [], isLoading: false, isError: false };
    exportState = { data: [] };

    const { result } = renderHook(() => useReportsData("u1", 1, "Dining"), { wrapper });
    expect(result.current.categoryTotals.map((c) => c.label)).toEqual(["Dining"]);
  });

  it("only includes budgets whose month/year falls in the selected range, joined with real server spend", () => {
    summaryState = {
      data: summary({
        rangeStart: "2025-04-01T00:00:00.000Z",
        rangeEnd: "2025-07-01T00:00:00.000Z",
        budgetsInRange: [{ categoryId: 1, year: 2025, month: 6, spent: 150 }],
      }),
      isLoading: false,
      isError: false,
    };
    budgetsState = {
      data: [
        { id: 1, amount: 200, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
        { id: 2, amount: 200, month: 1, year: 2024, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
      ],
      isLoading: false,
      isError: false,
    };
    exportState = { data: [] };

    const { result } = renderHook(() => useReportsData("u1", 3, ALL_CATEGORIES), { wrapper });
    expect(result.current.budgetsInRange).toHaveLength(1);
    expect(result.current.budgetsInRange[0].id).toBe(1);
    expect(result.current.budgetsInRange[0].spent).toBe(150);
  });

  it("does not synthesize budget rows while the summary has not loaded", () => {
    summaryState = { data: undefined, isLoading: true, isError: false };
    budgetsState = {
      data: [{ id: 1, amount: 200, month: 6, year: 2025, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } }],
      isLoading: false,
      isError: false,
    };
    exportState = { data: undefined };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES), { wrapper });
    expect(result.current.budgetsInRange).toHaveLength(0);
  });

  it("builds the category filter list with 'All Categories' first, from the server's real category-name list", () => {
    summaryState = { data: summary({ categoryNames: ["Apple", "Zebra"] }), isLoading: false, isError: false };
    budgetsState = { data: [], isLoading: false, isError: false };
    exportState = { data: [] };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES), { wrapper });
    expect(result.current.categoryNames).toEqual(["All Categories", "Apple", "Zebra"]);
  });

  it("distinguishes a brand-new user (never any transactions) from real zero activity in the selected window", () => {
    summaryState = { data: summary({ hasAnyTransactionsEver: false }), isLoading: false, isError: false };
    budgetsState = { data: [], isLoading: false, isError: false };
    exportState = { data: [] };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES), { wrapper });
    expect(result.current.transactionsList.hasAnyDataEver).toBe(false);
  });

  it("exposes the exhaustively-batched export rows scoped to the server's real range/category filter", () => {
    const rows: TransactionWithCat[] = [
      { id: 1, amount: 10, merchant: "A", note: null, created_at: null, occurred_at: "2025-06-01T12:00:00Z", category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
    ];
    summaryState = { data: summary(), isLoading: false, isError: false };
    budgetsState = { data: [], isLoading: false, isError: false };
    exportState = { data: rows };

    const { result } = renderHook(() => useReportsData("u1", 1, ALL_CATEGORIES), { wrapper });
    expect(result.current.transactionsInRange).toEqual(rows);
  });
});
