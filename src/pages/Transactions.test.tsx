import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Transactions from "./Transactions";

vi.mock("../components/TransactionFilterBar", () => ({
  TransactionFilterBar: () => <div>Filter bar</div>,
}));

vi.mock("../components/TransactionTable", () => ({
  TransactionTable: ({ onAddTransaction }: { onAddTransaction: () => void }) => (
    <div>
      Transaction table
      <button onClick={onAddTransaction}>Add from empty state</button>
    </div>
  ),
}));

let exportRows: unknown[] = [];

vi.mock("../features/transactions/useTransactions", () => ({
  useSaveTransaction: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
  useTransactionWithFilters: () => ({
    data: { rows: [], totalCount: 0 },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useExportTransactionsWithFilters: () => ({ data: exportRows, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));

vi.mock("../features/transactions/useTransactionsActivitySummary", () => ({
  useTransactionsActivitySummary: () => ({
    data: {
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
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("../features/categories/useCategories", () => ({
  useListCategories: () => ({ data: [], isLoading: false, isFetching: false, isError: false, error: null }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useListGlobalExpenseCategories: () => ({ data: [], isLoading: false, isFetching: false, isError: false, error: null }),
}));

vi.mock("../features/profiles/useProfile", () => ({
  useProfile: () => ({ data: { timezone: "America/Los_Angeles" }, isLoading: false, isError: false }),
}));

describe("Transactions page", () => {
  afterEach(() => {
    vi.clearAllMocks();
    exportRows = [];
  });

  it("renders the page heading, filter bar, and transaction table", () => {
    renderWithProviders(<Transactions />);

    expect(screen.getByRole("heading", { name: "Financial Activity" })).toBeInTheDocument();
    expect(screen.getByText("Filter bar")).toBeInTheDocument();
    expect(screen.getByText("Transaction table")).toBeInTheDocument();
  });

  it("uses a truthful subtitle that never claims connected financial accounts", () => {
    renderWithProviders(<Transactions />);

    expect(screen.queryByText(/connected accounts/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/review and manage your income, expenses, and recent financial activity/i)
    ).toBeInTheDocument();
  });

  it("disables Export when there are no transactions currently shown", () => {
    renderWithProviders(<Transactions />);

    expect(screen.getByRole("button", { name: /^export$/i })).toBeDisabled();
  });

  it("enables Export and describes it truthfully as exporting all filtered matches, not a fixed 50-row cap", () => {
    exportRows = [{ id: 1 }, { id: 2 }];
    renderWithProviders(<Transactions />);

    const exportButton = screen.getByRole("button", { name: /^export$/i });
    expect(exportButton).toBeEnabled();
    expect(exportButton).toHaveAttribute("title", "Export all transactions matching your current filters as CSV");
    expect(exportButton.getAttribute("title")).not.toMatch(/50/);
  });

  it("links Split a Receipt to the Split Expenses page as a contextual entry point", () => {
    renderWithProviders(<Transactions />);
    expect(screen.getByRole("link", { name: /split a receipt/i })).toHaveAttribute("href", "/split");
  });

  it("opens the Add Transaction dialog from the page header action", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Transactions />);

    await user.click(screen.getByRole("button", { name: /^add transaction$/i }));

    expect(await screen.findByRole("dialog", { name: /add transaction/i })).toBeInTheDocument();
  });

  it("opens the same dialog from the table's empty-state action", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Transactions />);

    await user.click(screen.getByRole("button", { name: /add from empty state/i }));

    expect(await screen.findByRole("dialog", { name: /add transaction/i })).toBeInTheDocument();
  });

  it("closes the dialog on cancel", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Transactions />);

    await user.click(screen.getByRole("button", { name: /^add transaction$/i }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
