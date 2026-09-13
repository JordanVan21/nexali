import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useBudgetsForPeriod } from "./useBudgetsForPeriod";
import type { TransactionWithCat } from "../../lib/transactions";
import type { Budget } from "../../lib/budgets";

let txState: { data?: TransactionWithCat[]; isLoading: boolean; isError: boolean };
let budgetsState: { data?: Budget[]; isLoading: boolean; isError: boolean };

vi.mock("../transactions/useTransactions", () => ({
  useTransactions: () => ({ ...txState, refetch: vi.fn() }),
}));

vi.mock("./useBudgets", () => ({
  useBudgets: () => ({ ...budgetsState, refetch: vi.fn() }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function tx(overrides: Partial<TransactionWithCat> & { created_at: string }): TransactionWithCat {
  return {
    id: overrides.id ?? 1,
    amount: 0,
    merchant: null,
    note: null,
    category_id: 1,
    categories: { id: 1, name: "Groceries", type: "expense" },
    ...overrides,
  };
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 1,
    amount: 200,
    month: 6,
    year: 2025,
    category_id: 1,
    categories: { id: 1, name: "Groceries", type: "expense" },
    ...overrides,
  };
}

describe("useBudgetsForPeriod", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("only includes budgets matching the requested month/year, not other periods", () => {
    budgetsState = {
      data: [budget({ id: 1, month: 6, year: 2025 }), budget({ id: 2, month: 5, year: 2025 })],
      isLoading: false,
      isError: false,
    };
    txState = { data: [], isLoading: false, isError: false };

    const { result } = renderHook(() => useBudgetsForPeriod("u1", 2025, 6), { wrapper });

    expect(result.current.budgets).toHaveLength(1);
    expect(result.current.budgets[0].id).toBe(1);
  });

  it("aggregates real per-budget spend into the period summary", () => {
    budgetsState = { data: [budget({ amount: 200 })], isLoading: false, isError: false };
    txState = { data: [tx({ amount: 150, created_at: "2025-06-05T12:00:00Z" })], isLoading: false, isError: false };

    const { result } = renderHook(() => useBudgetsForPeriod("u1", 2025, 6), { wrapper });

    expect(result.current.summary.totalBudget).toBe(200);
    expect(result.current.summary.totalSpent).toBe(150);
    expect(result.current.summary.available).toBe(50);
    expect(result.current.summary.efficiency).toBe(75);
  });

  it("does not clamp efficiency at 100 when the period is over budget overall", () => {
    budgetsState = { data: [budget({ amount: 100 })], isLoading: false, isError: false };
    txState = { data: [tx({ amount: 150, created_at: "2025-06-05T12:00:00Z" })], isLoading: false, isError: false };

    const { result } = renderHook(() => useBudgetsForPeriod("u1", 2025, 6), { wrapper });

    expect(result.current.summary.efficiency).toBe(150);
    expect(result.current.summary.available).toBe(-50);
  });

  it("counts warnings as budgets not in normal status", () => {
    budgetsState = {
      data: [budget({ id: 1, amount: 100, category_id: 1 }), budget({ id: 2, amount: 100, category_id: 2, categories: { id: 2, name: "B", type: "expense" } })],
      isLoading: false,
      isError: false,
    };
    txState = {
      data: [
        tx({ amount: 10, created_at: "2025-06-01T12:00:00Z", category_id: 1 }), // normal
        tx({ amount: 90, created_at: "2025-06-01T12:00:00Z", category_id: 2 }), // warning
      ],
      isLoading: false,
      isError: false,
    };

    const { result } = renderHook(() => useBudgetsForPeriod("u1", 2025, 6), { wrapper });
    expect(result.current.warningsCount).toBe(1);
  });

  it("flags hasNeverCreatedAny only when the user has zero budgets in any period", () => {
    budgetsState = { data: [], isLoading: false, isError: false };
    txState = { data: [], isLoading: false, isError: false };
    const { result: none } = renderHook(() => useBudgetsForPeriod("u1", 2025, 6), { wrapper });
    expect(none.current.budgetsList.hasNeverCreatedAny).toBe(true);

    budgetsState = { data: [budget({ month: 1, year: 2020 })], isLoading: false, isError: false };
    const { result: other } = renderHook(() => useBudgetsForPeriod("u1", 2025, 6), { wrapper });
    expect(other.current.budgetsList.hasNeverCreatedAny).toBe(false);
    // The user has budgets, just none for the requested period.
    expect(other.current.budgets).toHaveLength(0);
  });

  it("reports the budgets query and the transactions query as independent error states", () => {
    budgetsState = { data: undefined, isLoading: false, isError: true };
    txState = { data: [], isLoading: false, isError: false };
    const { result } = renderHook(() => useBudgetsForPeriod("u1", 2025, 6), { wrapper });

    expect(result.current.budgetsList.isError).toBe(true);
    expect(result.current.spendData.isError).toBe(false);
  });

  it("does not report a fake zero spend when the transaction query fails", () => {
    budgetsState = { data: [budget()], isLoading: false, isError: false };
    txState = { data: undefined, isLoading: false, isError: true };

    const { result } = renderHook(() => useBudgetsForPeriod("u1", 2025, 6), { wrapper });

    expect(result.current.spendData.isError).toBe(true);
    // No progress rows are synthesized from missing transaction data.
    expect(result.current.budgets).toHaveLength(0);
  });
});
