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

vi.mock("../features/transactions/useTransactions", () => ({
  useSaveTransaction: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
  useTransactionWithFilters: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useTransactions: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));

vi.mock("../features/categories/useCategories", () => ({
  useListCategories: () => ({ data: [], isLoading: false, isFetching: false, isError: false, error: null }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("Transactions page", () => {
  afterEach(() => {
    vi.clearAllMocks();
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
