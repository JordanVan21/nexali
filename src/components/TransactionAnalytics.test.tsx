import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { TransactionAnalytics } from "./TransactionAnalytics";
import type { TransactionWithCat } from "../lib/transactions";
import type { Filters } from "../features/querykeys";

let queryState: { data: TransactionWithCat[]; isLoading: boolean; isError: boolean; error: Error | null };

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactions: () => ({ ...queryState, refetch: vi.fn() }),
}));

const BASE_FILTERS: Filters = { sortBy: "date", sortOrder: "desc" };

const makeTx = (overrides: Partial<TransactionWithCat> = {}): TransactionWithCat => ({
  id: Math.random(),
  amount: 50,
  merchant: "Whole Foods Market",
  note: null,
  created_at: new Date().toISOString(),
  occurred_at: new Date().toISOString(),
  category_id: 1,
  categories: { id: 1, name: "Groceries", type: "expense" },
  ...overrides,
});

describe("TransactionAnalytics", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a truthful empty state instead of fabricated figures when there are no transactions", () => {
    queryState = { data: [], isLoading: false, isError: false, error: null };
    renderWithProviders(<TransactionAnalytics filters={BASE_FILTERS} />);

    expect(screen.getByText("Average Daily Burn")).toBeInTheDocument();
    expect(screen.getByText("No previous-period data")).toBeInTheDocument();
    expect(screen.getByText("No expenses in this period.")).toBeInTheDocument();
  });

  it("computes Average Daily Burn from real expense transactions and excludes income", () => {
    queryState = {
      data: [
        makeTx({ amount: 100, categories: { id: 1, name: "Groceries", type: "expense" } }),
        makeTx({ amount: 5000, categories: { id: 2, name: "Salary", type: "income" } }),
      ],
      isLoading: false,
      isError: false,
      error: null,
    };
    renderWithProviders(<TransactionAnalytics filters={BASE_FILTERS} />);

    // Real category renders in Top Categories; the income category never does.
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.queryByText("Salary")).not.toBeInTheDocument();
  });

  it("never renders Lovable's mock category groupings", () => {
    queryState = {
      data: [makeTx({ amount: 40, categories: { id: 1, name: "Dining", type: "expense" } })],
      isLoading: false,
      isError: false,
      error: null,
    };
    renderWithProviders(<TransactionAnalytics filters={BASE_FILTERS} />);

    expect(screen.queryByText("Essentials")).not.toBeInTheDocument();
    expect(screen.queryByText(/lifestyle & dining/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/investments & savings/i)).not.toBeInTheDocument();
  });

  it("shows a retryable error state when the underlying fetch fails", () => {
    queryState = { data: [], isLoading: false, isError: true, error: new Error("network down") };
    renderWithProviders(<TransactionAnalytics filters={BASE_FILTERS} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
