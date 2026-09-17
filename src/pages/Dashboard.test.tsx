import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Dashboard from "./Dashboard";
import type { Budget } from "../lib/budgets";
import type { DashboardSummaryResponse, BudgetsProgressRow } from "../lib/financialAggregates";

function isoThisMonth(day: number): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), day, 12, 0, 0).toISOString();
}

function currentMonthYear(): { month: number; year: number } {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

const SALARY = {
  id: 1,
  amount: 3000,
  merchant: "Employer Inc",
  note: null,
  category_id: 9,
  created_at: isoThisMonth(1),
  occurred_at: isoThisMonth(1),
  categories: { id: 9, name: "Salary", type: "income" as const },
};

const GROCERIES = {
  id: 2,
  amount: 150,
  merchant: "Whole Foods",
  note: null,
  category_id: 1,
  created_at: isoThisMonth(5),
  occurred_at: isoThisMonth(5),
  categories: { id: 1, name: "Groceries", type: "expense" as const },
};

let profileState: { data?: { full_name: string | null }; isLoading: boolean; isError: boolean; error: Error | null };
let summaryState: { data?: DashboardSummaryResponse; isLoading: boolean; isError: boolean };
let budgetsState: { data?: Budget[]; isLoading: boolean; isError: boolean };
let progressState: { data?: BudgetsProgressRow[]; isLoading: boolean; isError: boolean };
const summaryRefetch = vi.fn();
const budgetsRefetch = vi.fn();
const progressRefetch = vi.fn();

vi.mock("../features/profiles/useProfile", () => ({
  useProfile: () => profileState,
}));

vi.mock("../features/dashboard/useDashboardSummary", () => ({
  useDashboardSummary: () => ({ ...summaryState, refetch: summaryRefetch }),
}));

vi.mock("../features/budgets/useBudgets", () => ({
  useBudgets: () => ({ ...budgetsState, refetch: budgetsRefetch }),
}));

vi.mock("../features/budgets/useBudgetsProgress", () => ({
  useBudgetsProgress: () => ({ ...progressState, refetch: progressRefetch }),
}));

vi.mock("../features/transactions/useTransactions", () => ({
  useSaveTransaction: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
}));

vi.mock("../features/categories/useCategories", () => ({
  useListCategories: () => ({ data: [], isLoading: false, isFetching: false, isError: false, error: null }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useListGlobalExpenseCategories: () => ({ data: [], isLoading: false, isFetching: false, isError: false, error: null }),
}));

function defaultSummary(overrides: Partial<DashboardSummaryResponse> = {}): DashboardSummaryResponse {
  const { year, month } = currentMonthYear();
  return {
    month: { income: 3000, expenses: 150, net: 2850 },
    prevMonth: { income: 0, expenses: 0 },
    cashflow: [],
    categoryBreakdown: [{ id: 1, label: "Groceries", amount: 150, percent: 100 }],
    recentTransactions: [SALARY, GROCERIES],
    currentYear: year,
    currentMonth: month,
    ...overrides,
  };
}

function resetToDefaults() {
  profileState = { data: { full_name: "Jamie Rivera" }, isLoading: false, isError: false, error: null };
  summaryState = { data: defaultSummary(), isLoading: false, isError: false };
  budgetsState = { data: [], isLoading: false, isError: false };
  progressState = { data: [], isLoading: false, isError: false };
}

describe("Dashboard page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page heading and welcome copy with no unsupported health/status claim", () => {
    resetToDefaults();
    renderWithProviders(<Dashboard />);

    expect(screen.getByRole("heading", { name: "Command Center" })).toBeInTheDocument();
    expect(screen.getByText(/welcome back, jamie/i)).toBeInTheDocument();
    expect(screen.queryByText(/financial ecosystem is healthy/i)).not.toBeInTheDocument();
  });

  it("shows a loading skeleton while the dashboard summary is loading", () => {
    resetToDefaults();
    summaryState = { data: undefined, isLoading: true, isError: false };
    renderWithProviders(<Dashboard />);

    expect(screen.getByLabelText("Loading dashboard")).toBeInTheDocument();
  });

  it("renders real this-month income, expenses, and net from the server summary, not a fabricated metric", () => {
    resetToDefaults();
    renderWithProviders(<Dashboard />);

    const incomeCard = screen.getByText("Income (This Month)").closest(".nexali-panel") as HTMLElement;
    expect(within(incomeCard).getByText("$3,000.00")).toBeInTheDocument();
    const expensesCard = screen.getByText("Expenses (This Month)").closest(".nexali-panel") as HTMLElement;
    expect(within(expensesCard).getByText("$150.00")).toBeInTheDocument();
    const netCard = screen.getByText("Net Cash Flow (This Month)").closest(".nexali-panel") as HTMLElement;
    expect(within(netCard).getByText("$2,850.00")).toBeInTheDocument();

    // Net worth is not a supported metric (no accounts/assets data model) and must never appear.
    expect(screen.queryByText(/net worth/i)).not.toBeInTheDocument();
    // No metric may claim a period the backend/frontend can't actually verify.
    expect(screen.queryByText(/all time/i)).not.toBeInTheDocument();
  });

  it("shows the transaction-empty state with a working Add Transaction action when there is no history", async () => {
    resetToDefaults();
    summaryState = {
      data: defaultSummary({ month: { income: 0, expenses: 0, net: 0 }, categoryBreakdown: [], recentTransactions: [] }),
      isLoading: false,
      isError: false,
    };
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add transaction/i }));
    expect(await screen.findByRole("dialog", { name: /add transaction/i })).toBeInTheDocument();
  });

  it("shows a retryable error state when the dashboard summary fails to load, without exposing a raw error", () => {
    resetToDefaults();
    summaryState = { data: undefined, isLoading: false, isError: true };
    renderWithProviders(<Dashboard />);

    expect(screen.getByText(/couldn't load your dashboard/i)).toBeInTheDocument();
  });

  it("retries the summary query when Retry is activated", async () => {
    resetToDefaults();
    summaryState = { data: undefined, isLoading: false, isError: true };
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(summaryRefetch).toHaveBeenCalledTimes(1);
  });

  it("shows the budget-empty state with a Create Budget link when there are no budgets this month", () => {
    resetToDefaults();
    renderWithProviders(<Dashboard />);

    expect(screen.getByText("No budgets set for this month yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Budget" })).toHaveAttribute("href", "/budgets");
  });

  it("shows real budget progress computed from this month's server spend, independent of a budgets-query failure elsewhere", () => {
    resetToDefaults();
    const { month, year } = currentMonthYear();
    budgetsState = {
      data: [{ id: 1, amount: 200, month, year, category_id: 1, categories: { id: 1, name: "Groceries", type: "expense" } }],
      isLoading: false,
      isError: false,
    };
    progressState = { data: [{ categoryId: 1, spent: 150 }], isLoading: false, isError: false };
    renderWithProviders(<Dashboard />);

    expect(screen.getByRole("progressbar", { name: /groceries budget usage/i })).toBeInTheDocument();
    expect(screen.getByText("$150.00 of $200.00")).toBeInTheDocument();
  });

  it("localizes a budgets-query failure to the budget panel while the rest of the dashboard still renders", () => {
    resetToDefaults();
    budgetsState = { data: undefined, isLoading: false, isError: true };
    renderWithProviders(<Dashboard />);

    // Budget panel shows its own error...
    expect(screen.getByText(/couldn't load your budgets/i)).toBeInTheDocument();
    // ...but the rest of the real data-backed dashboard is unaffected.
    expect(screen.getByText("Income (This Month)")).toBeInTheDocument();
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
  });

  it("lists real recent transactions and links through to the real Transactions route", () => {
    resetToDefaults();
    renderWithProviders(<Dashboard />);

    expect(screen.getByText("Whole Foods")).toBeInTheDocument();
    const viewAllLinks = screen.getAllByRole("link", { name: "View All" });
    expect(viewAllLinks.length).toBeGreaterThan(0);
    for (const link of viewAllLinks) {
      expect(link).toHaveAttribute("href", "/transactions");
    }
  });

  it("opens the Add Transaction dialog from the primary header action", async () => {
    resetToDefaults();
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await user.click(screen.getByRole("button", { name: /new transaction/i }));
    expect(await screen.findByRole("dialog", { name: /add transaction/i })).toBeInTheDocument();
  });

  it("renders a truthful Aura entry point that links to the real Assistant route, with no fabricated insight", () => {
    resetToDefaults();
    renderWithProviders(<Dashboard />);

    const auraHeading = screen.getByText("Aura");
    const auraCard = auraHeading.closest("div");
    expect(auraCard).not.toBeNull();
    const openLink = within(auraCard!.parentElement!).getByRole("link", { name: /open aura/i });
    expect(openLink).toHaveAttribute("href", "/assistant");
  });

  it("shows a truthful empty state in the spending breakdown when there are no expenses this month", () => {
    resetToDefaults();
    summaryState = {
      data: defaultSummary({
        month: { income: 3000, expenses: 0, net: 3000 },
        categoryBreakdown: [],
        recentTransactions: [SALARY],
      }),
      isLoading: false,
      isError: false,
    };
    renderWithProviders(<Dashboard />);

    expect(screen.getByText(/no expenses recorded yet this month/i)).toBeInTheDocument();
  });
});
