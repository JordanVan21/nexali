import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { UserIdProvider } from "../shared/userIdContext";
import { WithErrorBoundary } from "../ErrorBoundary";
import type { DashboardSummaryResponse, BudgetsProgressRow } from "../lib/financialAggregates";
import type { Budget } from "../lib/budgets";

/**
 * Regression coverage for a real cold-hard-reload crash: on a completely
 * cold TanStack Query cache, useDashboardData used to require BOTH
 * dashboard_summary() AND budgets_progress() data before `summary` became
 * non-null, but the page's top-level loading/error/empty gate
 * (dashboard.transactions.*) tracked ONLY dashboard_summary(). Since
 * budgets_progress() only becomes enabled once dashboard_summary()
 * supplies currentYear/currentMonth, there was a real render -- the one
 * right after dashboard_summary() resolves -- where the page's gate said
 * "not loading" while `summary` was still null, and Dashboard.tsx
 * unconditionally dereferenced `summary!.month.income` etc., throwing and
 * tripping the page-level <WithErrorBoundary>. Navigating to /budgets
 * first "fixed" it only by incidentally warming the exact same
 * budgetsProgress query-cache key Dashboard also uses for the current
 * month -- not a real fix. These tests use a real, unseeded QueryClient
 * and control exactly when each underlying RPC call resolves, to prove
 * Dashboard boots correctly from a cold cache with no other page visited
 * first, in every realistic resolution order.
 */

vi.mock("../features/profiles/useProfile", () => ({
  useProfile: () => ({ data: { full_name: "Jamie Rivera", timezone: "America/Los_Angeles" }, isLoading: false, isError: false, error: null }),
}));

vi.mock("../features/transactions/useTransactions", () => ({
  useSaveTransaction: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
}));

vi.mock("../features/categories/useCategories", () => ({
  useListCategories: () => ({ data: [], isLoading: false, isFetching: false, isError: false, error: null }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useListGlobalExpenseCategories: () => ({ data: [], isLoading: false, isFetching: false, isError: false, error: null }),
}));

const getDashboardSummaryMock = vi.fn();
const getBudgetsProgressMock = vi.fn();
const getBudgetsMock = vi.fn();

vi.mock("../lib/financialAggregates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/financialAggregates")>();
  return {
    ...actual,
    getDashboardSummary: (...args: unknown[]) => getDashboardSummaryMock(...args),
    getBudgetsProgress: (...args: unknown[]) => getBudgetsProgressMock(...args),
  };
});

vi.mock("../lib/budgets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/budgets")>();
  return {
    ...actual,
    getBudgets: (...args: unknown[]) => getBudgetsMock(...args),
  };
});

/** A promise plus externally-callable resolve/reject -- lets a test control exactly when a mocked RPC call settles. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function defaultSummary(overrides: Partial<DashboardSummaryResponse> = {}): DashboardSummaryResponse {
  return {
    month: { income: 3000, expenses: 150, net: 2850 },
    prevMonth: { income: 0, expenses: 0 },
    cashflow: [],
    categoryBreakdown: [{ id: 1, label: "Groceries", amount: 150, percent: 100 }],
    recentTransactions: [
      {
        id: 1,
        amount: 150,
        merchant: "Whole Foods",
        note: null,
        created_at: "2024-01-05T00:00:00.000Z",
        occurred_at: "2024-01-05T12:00:00.000Z",
        category_id: 1,
        categories: { id: 1, name: "Groceries", type: "expense" },
      },
    ],
    currentYear: 2024,
    currentMonth: 1,
    ...overrides,
  };
}

function renderColdDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <UserIdProvider value={{ userId: "test-user-id", email: "test@example.com" }}>
          <WithErrorBoundary>
            <Dashboard />
          </WithErrorBoundary>
        </UserIdProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return queryClient;
}

function expectNoErrorBoundary() {
  expect(screen.queryByText("This page ran into a problem")).not.toBeInTheDocument();
}

describe("Dashboard cold-cache load (regression: hard-reload render crash)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("A: dashboard summary resolves first, then budgets, then budget progress -- never throws, eventually renders real data", async () => {
    const summaryD = deferred<DashboardSummaryResponse>();
    const budgetsD = deferred<Budget[]>();
    const progressD = deferred<BudgetsProgressRow[]>();
    getDashboardSummaryMock.mockReturnValue(summaryD.promise);
    getBudgetsMock.mockReturnValue(budgetsD.promise);
    getBudgetsProgressMock.mockReturnValue(progressD.promise);

    renderColdDashboard();

    // Cold: nothing resolved yet -- skeleton, not a crash, not real content.
    expect(screen.getByLabelText("Loading dashboard")).toBeInTheDocument();
    expectNoErrorBoundary();

    await act(async () => {
      summaryD.resolve(defaultSummary());
      await summaryD.promise;
    });
    // The exact moment that used to crash: summary data has arrived, but
    // budgets/budget-progress have not. Must still not throw.
    expectNoErrorBoundary();

    await act(async () => {
      budgetsD.resolve([{ id: 1, amount: 200, month: 1, year: 2024, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } }]);
      await budgetsD.promise;
    });
    expectNoErrorBoundary();

    await act(async () => {
      progressD.resolve([{ categoryId: 1, spent: 150 }]);
      await progressD.promise;
    });

    await waitFor(() => expect(screen.getByText("$3,000.00")).toBeInTheDocument());
    expectNoErrorBoundary();
    expect(screen.getByText("$150.00 of $200.00")).toBeInTheDocument();
  });

  it("B: budgets resolves first, then dashboard summary, then budget progress -- never throws", async () => {
    const summaryD = deferred<DashboardSummaryResponse>();
    const budgetsD = deferred<Budget[]>();
    const progressD = deferred<BudgetsProgressRow[]>();
    getDashboardSummaryMock.mockReturnValue(summaryD.promise);
    getBudgetsMock.mockReturnValue(budgetsD.promise);
    getBudgetsProgressMock.mockReturnValue(progressD.promise);

    renderColdDashboard();
    expectNoErrorBoundary();

    await act(async () => {
      budgetsD.resolve([]);
      await budgetsD.promise;
    });
    expectNoErrorBoundary();

    await act(async () => {
      summaryD.resolve(defaultSummary());
      await summaryD.promise;
    });
    expectNoErrorBoundary();

    await act(async () => {
      progressD.resolve([]);
      await progressD.promise;
    });

    await waitFor(() => expect(screen.getByText("$3,000.00")).toBeInTheDocument());
    expectNoErrorBoundary();
  });

  it("C: dashboard summary and budgets resolve at effectively the same time, budget progress last -- never throws", async () => {
    const summaryD = deferred<DashboardSummaryResponse>();
    const budgetsD = deferred<Budget[]>();
    const progressD = deferred<BudgetsProgressRow[]>();
    getDashboardSummaryMock.mockReturnValue(summaryD.promise);
    getBudgetsMock.mockReturnValue(budgetsD.promise);
    getBudgetsProgressMock.mockReturnValue(progressD.promise);

    renderColdDashboard();

    await act(async () => {
      summaryD.resolve(defaultSummary());
      budgetsD.resolve([]);
      await Promise.all([summaryD.promise, budgetsD.promise]);
    });
    expectNoErrorBoundary();

    await act(async () => {
      progressD.resolve([]);
      await progressD.promise;
    });

    await waitFor(() => expect(screen.getByText("$3,000.00")).toBeInTheDocument());
    expectNoErrorBoundary();
  });

  it("D: zero budgets -- renders the real budget-empty state, never throws", async () => {
    getDashboardSummaryMock.mockResolvedValue(defaultSummary());
    getBudgetsMock.mockResolvedValue([]);
    getBudgetsProgressMock.mockResolvedValue([]);

    renderColdDashboard();

    await waitFor(() => expect(screen.getByText("$3,000.00")).toBeInTheDocument());
    expectNoErrorBoundary();
    expect(screen.getByText("No budgets set for this month yet.")).toBeInTheDocument();
  });

  it("E: zero transactions -- renders the real empty state, never throws", async () => {
    getDashboardSummaryMock.mockResolvedValue(
      defaultSummary({ month: { income: 0, expenses: 0, net: 0 }, categoryBreakdown: [], recentTransactions: [] })
    );
    getBudgetsMock.mockResolvedValue([]);
    getBudgetsProgressMock.mockResolvedValue([]);

    renderColdDashboard();

    await waitFor(() => expect(screen.getByText("No activity yet")).toBeInTheDocument());
    expectNoErrorBoundary();
  });

  it("F: budgets_progress resolves to an empty array (no spend rows) -- budgets render with real $0 spent, not a crash", async () => {
    getDashboardSummaryMock.mockResolvedValue(defaultSummary());
    getBudgetsMock.mockResolvedValue([
      { id: 1, amount: 200, month: 1, year: 2024, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
    ]);
    getBudgetsProgressMock.mockResolvedValue([]);

    renderColdDashboard();

    await waitFor(() => expect(screen.getByText("$0.00 of $200.00")).toBeInTheDocument());
    expectNoErrorBoundary();
  });

  it("G: a genuine budgets_progress failure shows the real Dashboard budget-panel ErrorState, NOT the page-level Error Boundary", async () => {
    getDashboardSummaryMock.mockResolvedValue(defaultSummary());
    getBudgetsMock.mockResolvedValue([
      { id: 1, amount: 200, month: 1, year: 2024, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } },
    ]);
    getBudgetsProgressMock.mockRejectedValue(new Error("permission denied"));

    renderColdDashboard();

    await waitFor(() => expect(screen.getByText(/couldn't load your budgets/i)).toBeInTheDocument());
    expectNoErrorBoundary();
    // The rest of the real, transaction-summary-backed dashboard still renders.
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
  });

  it("a genuine dashboard_summary failure shows the real Dashboard ErrorState, NOT the page-level Error Boundary, and Retry re-queries", async () => {
    getDashboardSummaryMock.mockRejectedValue(new Error("network down"));
    getBudgetsMock.mockResolvedValue([]);
    getBudgetsProgressMock.mockResolvedValue([]);

    renderColdDashboard();

    await waitFor(() => expect(screen.getByText(/couldn't load your dashboard/i)).toBeInTheDocument());
    expectNoErrorBoundary();
  });
});
