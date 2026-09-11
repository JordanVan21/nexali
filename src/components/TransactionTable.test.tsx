import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import { TransactionTable } from "./TransactionTable";
import type { TransactionWithCat } from "../lib/transactions";
import type { Filters } from "../features/querykeys";

const refetch = vi.fn();
const deleteMutate = vi.fn();
let queryState: {
  data: TransactionWithCat[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};
let deleteState: { isPending: boolean; isError: boolean; error: Error | null } = {
  isPending: false,
  isError: false,
  error: null,
};

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactionWithFilters: () => ({ ...queryState, refetch }),
  useDeleteTransaction: () => ({
    mutate: deleteMutate,
    get isPending() {
      return deleteState.isPending;
    },
    get isError() {
      return deleteState.isError;
    },
    get error() {
      return deleteState.error;
    },
  }),
}));

const NO_FILTERS: Filters = { sortBy: "date", sortOrder: "desc" };

const makeTx = (overrides: Partial<TransactionWithCat> = {}): TransactionWithCat => ({
  id: 1,
  amount: 42.5,
  merchant: "Whole Foods Market",
  note: null,
  created_at: "2024-01-15T00:00:00.000Z",
  category_id: 1,
  categories: { id: 1, name: "Groceries", type: "expense" },
  ...overrides,
});

function renderTable(filters: Filters = NO_FILTERS) {
  return renderWithProviders(
    <TransactionTable filters={filters} onAddTransaction={vi.fn()} onEditTransaction={vi.fn()} />
  );
}

describe("TransactionTable", () => {
  afterEach(() => {
    vi.clearAllMocks();
    deleteState = { isPending: false, isError: false, error: null };
  });

  it("shows a loading skeleton while the initial fetch is pending", () => {
    queryState = { data: [], isLoading: true, isError: false, error: null };
    renderTable();

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/no transactions/i)).not.toBeInTheDocument();
  });

  it("shows a retryable error state when the fetch fails", async () => {
    queryState = { data: [], isLoading: false, isError: true, error: new Error("network down") };
    const user = userEvent.setup();
    renderTable();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows a 'no transactions yet' empty state with an Add action when the account has none", () => {
    queryState = { data: [], isLoading: false, isError: false, error: null };
    renderTable();

    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add transaction/i })).toBeInTheDocument();
  });

  it("shows a distinguishable 'no matches' empty state when filters exclude everything", () => {
    queryState = { data: [], isLoading: false, isError: false, error: null };
    renderTable({ ...NO_FILTERS, search: "nonexistent" });

    expect(screen.getByText(/no transactions match these filters/i)).toBeInTheDocument();
    expect(screen.queryByText(/^no transactions yet$/i)).not.toBeInTheDocument();
  });

  it("renders income and expense with both an icon/text label and color, not color alone", () => {
    queryState = {
      data: [
        makeTx({ id: 1, amount: 42.5, categories: { id: 1, name: "Groceries", type: "expense" } }),
        makeTx({ id: 2, amount: 4250, merchant: "Stripe Payout", categories: { id: 2, name: "Salary", type: "income" } }),
      ],
      isLoading: false,
      isError: false,
      error: null,
    };
    renderTable();

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Expense")).toBeInTheDocument();
    expect(table.getByText("Income")).toBeInTheDocument();
    expect(table.getByText("-$42.50")).toBeInTheDocument();
    expect(table.getByText("+$4,250.00")).toBeInTheDocument();
  });

  it("calls onEditTransaction when the desktop Edit action is used", async () => {
    const tx = makeTx();
    queryState = { data: [tx], isLoading: false, isError: false, error: null };
    const onEditTransaction = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <TransactionTable filters={NO_FILTERS} onAddTransaction={vi.fn()} onEditTransaction={onEditTransaction} />
    );

    const table = within(screen.getByRole("table"));
    await user.click(table.getByRole("button", { name: /edit transaction/i }));

    expect(onEditTransaction).toHaveBeenCalledWith(tx);
  });

  it("requires confirmation before deleting: the mutation does not run until Delete is confirmed", async () => {
    const tx = makeTx();
    queryState = { data: [tx], isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderTable();

    const table = within(screen.getByRole("table"));
    await user.click(table.getByRole("button", { name: /delete transaction/i }));

    expect(await screen.findByText(/delete transaction\?/i)).toBeInTheDocument();
    expect(deleteMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteMutate).toHaveBeenCalledWith(tx.id, expect.anything());
  });

  it("cancelling the confirmation dialog does not delete", async () => {
    const tx = makeTx();
    queryState = { data: [tx], isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderTable();

    const table = within(screen.getByRole("table"));
    await user.click(table.getByRole("button", { name: /delete transaction/i }));
    await user.click(await screen.findByRole("button", { name: /cancel/i }));

    expect(deleteMutate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/delete transaction\?/i)).not.toBeInTheDocument());
  });

  it("renders the same transactions in the mobile card list", () => {
    const tx = makeTx();
    queryState = { data: [tx], isLoading: false, isError: false, error: null };
    renderTable();

    const list = within(screen.getByRole("list"));
    expect(list.getByText("Whole Foods Market")).toBeInTheDocument();
  });
});
