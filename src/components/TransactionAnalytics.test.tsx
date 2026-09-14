import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { TransactionAnalytics } from "./TransactionAnalytics";
import type { Filters } from "../features/querykeys";
import type { TransactionsActivitySummaryResponse } from "../lib/financialAggregates";

let queryState: { data?: TransactionsActivitySummaryResponse; isLoading: boolean; isError: boolean; error: Error | null };
const refetch = vi.fn();

vi.mock("../features/transactions/useTransactionsActivitySummary", () => ({
  useTransactionsActivitySummary: () => ({ ...queryState, refetch }),
}));

const BASE_FILTERS: Filters = { sortBy: "date", sortOrder: "desc" };

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

describe("TransactionAnalytics", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a truthful empty state instead of fabricated figures when there are no transactions", () => {
    queryState = { data: summary(), isLoading: false, isError: false, error: null };
    renderWithProviders(<TransactionAnalytics filters={BASE_FILTERS} />);

    expect(screen.getByText("Average Daily Burn")).toBeInTheDocument();
    expect(screen.getByText("No previous-period data")).toBeInTheDocument();
    expect(screen.getByText("No expenses in this period.")).toBeInTheDocument();
  });

  it("renders the real server-computed Average Daily Burn and excludes income (the server never returns income in topCategories)", () => {
    queryState = {
      data: summary({ dailyRate: 10, expenseAmount: 100, topCategories: [{ id: 1, label: "Groceries", amount: 100, percent: 100 }] }),
      isLoading: false,
      isError: false,
      error: null,
    };
    renderWithProviders(<TransactionAnalytics filters={BASE_FILTERS} />);

    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.queryByText("Salary")).not.toBeInTheDocument();
  });

  it("shows a real percent-change badge when a previous-period baseline exists", () => {
    queryState = {
      data: summary({ dailyRate: 29, previousDailyRate: 10, changePercent: 190 }),
      isLoading: false,
      isError: false,
      error: null,
    };
    renderWithProviders(<TransactionAnalytics filters={BASE_FILTERS} />);

    expect(screen.getByText(/190% vs previous period/)).toBeInTheDocument();
  });

  it("never renders Lovable's mock category groupings", () => {
    queryState = {
      data: summary({ topCategories: [{ id: 1, label: "Dining", amount: 40, percent: 100 }] }),
      isLoading: false,
      isError: false,
      error: null,
    };
    renderWithProviders(<TransactionAnalytics filters={BASE_FILTERS} />);

    expect(screen.queryByText("Essentials")).not.toBeInTheDocument();
    expect(screen.queryByText(/lifestyle & dining/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/investments & savings/i)).not.toBeInTheDocument();
  });

  it("shows a retryable error state when the server aggregate fails, never a fake $0", () => {
    queryState = { data: undefined, isLoading: false, isError: true, error: new Error("network down") };
    renderWithProviders(<TransactionAnalytics filters={BASE_FILTERS} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });

  it("retries the activity summary query when Retry is activated", async () => {
    queryState = { data: undefined, isLoading: false, isError: true, error: new Error("network down") };
    renderWithProviders(<TransactionAnalytics filters={BASE_FILTERS} />);

    screen.getByRole("button", { name: /retry/i }).click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
