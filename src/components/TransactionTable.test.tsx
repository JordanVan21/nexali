import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, within, waitFor, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithProviders } from "../test/renderWithProviders";
import { UserIdProvider } from "../shared/userIdContext";
import { TransactionTable } from "./TransactionTable";
import type { TransactionWithCat } from "../lib/transactions";
import type { Filters } from "../features/querykeys";

const refetch = vi.fn();
const deleteMutate = vi.fn();
const useTransactionWithFiltersSpy = vi.fn();
let queryState: {
  data: { rows: TransactionWithCat[]; totalCount: number } | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};
let deleteState: { isPending: boolean; isError: boolean; error: Error | null } = {
  isPending: false,
  isError: false,
  error: null,
};

/**
 * When set, the mocked hook simulates a REAL server: it returns exactly the
 * page implied by the filters it's actually called with (limit/offset),
 * plus the real total count -- so tests using this exercise the same
 * page/range math TransactionTable really performs, not a canned response.
 */
let allRows: TransactionWithCat[] | null = null;

function pageOf(rows: TransactionWithCat[], filters: Filters) {
  const limit = filters.limit ?? 10;
  const offset = filters.offset ?? 0;
  return { rows: rows.slice(offset, offset + limit), totalCount: rows.length };
}

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactionWithFilters: (userId: string, filters: Filters) => {
    useTransactionWithFiltersSpy(userId, filters);
    if (allRows) {
      return { data: pageOf(allRows, filters), isLoading: false, isError: false, error: null, refetch };
    }
    return { ...queryState, refetch };
  },
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
  occurred_at: "2024-01-15T00:00:00.000Z",
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
    allRows = null;
  });

  it("shows a loading skeleton while the initial fetch is pending", () => {
    queryState = { data: { rows: [], totalCount: 0 }, isLoading: true, isError: false, error: null };
    renderTable();

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/no transactions/i)).not.toBeInTheDocument();
  });

  it("shows a retryable error state when the fetch fails", async () => {
    queryState = { data: { rows: [], totalCount: 0 }, isLoading: false, isError: true, error: new Error("network down") };
    const user = userEvent.setup();
    renderTable();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows a 'no transactions yet' empty state with an Add action when the account has none", () => {
    queryState = { data: { rows: [], totalCount: 0 }, isLoading: false, isError: false, error: null };
    renderTable();

    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add transaction/i })).toBeInTheDocument();
  });

  it("shows a distinguishable 'no matches' empty state when filters exclude everything", () => {
    queryState = { data: { rows: [], totalCount: 0 }, isLoading: false, isError: false, error: null };
    renderTable({ ...NO_FILTERS, search: "nonexistent" });

    expect(screen.getByText(/no transactions match these filters/i)).toBeInTheDocument();
    expect(screen.queryByText(/^no transactions yet$/i)).not.toBeInTheDocument();
  });

  it("renders income and expense with both an icon/text label and color, not color alone", () => {
    queryState = {
      data: {
        rows: [
          makeTx({ id: 1, amount: 42.5, categories: { id: 1, name: "Groceries", type: "expense" } }),
          makeTx({ id: 2, amount: 4250, merchant: "Stripe Payout", categories: { id: 2, name: "Salary", type: "income" } }),
        ],
        totalCount: 2,
      },
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
    queryState = { data: { rows: [tx], totalCount: 1 }, isLoading: false, isError: false, error: null };
    const onEditTransaction = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <TransactionTable filters={NO_FILTERS} onAddTransaction={vi.fn()} onEditTransaction={onEditTransaction} />
    );

    const table = within(screen.getByRole("table"));
    await user.click(table.getByRole("button", { name: /actions for whole foods market/i }));
    await user.click(await screen.findByText("Edit"));

    expect(onEditTransaction).toHaveBeenCalledWith(tx);
  });

  it("requires confirmation before deleting: the mutation does not run until Delete is confirmed", async () => {
    const tx = makeTx();
    queryState = { data: { rows: [tx], totalCount: 1 }, isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderTable();

    const table = within(screen.getByRole("table"));
    await user.click(table.getByRole("button", { name: /actions for whole foods market/i }));
    await user.click(await screen.findByText("Delete"));

    expect(await screen.findByText(/delete transaction\?/i)).toBeInTheDocument();
    expect(deleteMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteMutate).toHaveBeenCalledWith(tx.id, expect.anything());
  });

  it("cancelling the confirmation dialog does not delete", async () => {
    const tx = makeTx();
    queryState = { data: { rows: [tx], totalCount: 1 }, isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderTable();

    const table = within(screen.getByRole("table"));
    await user.click(table.getByRole("button", { name: /actions for whole foods market/i }));
    await user.click(await screen.findByText("Delete"));
    await user.click(await screen.findByRole("button", { name: /cancel/i }));

    expect(deleteMutate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/delete transaction\?/i)).not.toBeInTheDocument());
  });

  it("renders the same transactions in the mobile card list", () => {
    const tx = makeTx();
    queryState = { data: { rows: [tx], totalCount: 1 }, isLoading: false, isError: false, error: null };
    renderTable();

    const list = within(screen.getByRole("list"));
    expect(list.getByText("Whole Foods Market")).toBeInTheDocument();
  });
});

function makeRows(count: number): TransactionWithCat[] {
  return Array.from({ length: count }, (_, i) => makeTx({ id: i + 1, merchant: `Row ${i + 1}` }));
}

/**
 * Real server-pagination math, exercised through the real component against
 * a simulated real server (see `pageOf`/`allRows` above) -- not just a
 * canned mock response. Directly proves the old 50-row ceiling and
 * double-pagination bug (docs/BACKEND_AUDIT_REPORT.md P1-1) are gone: rows
 * far beyond 50 are reachable, and the footer/total always reflect the
 * real count the "server" reports, never the size of one fetched page.
 */
describe("TransactionTable server pagination", () => {
  afterEach(() => {
    vi.clearAllMocks();
    allRows = null;
  });

  it("shows the real empty state for 0 matching rows, not a page 1 of 0", () => {
    allRows = makeRows(0);
    renderTable();

    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows exactly 1 row and a correct '1-1 of 1' footer for 1 matching row", () => {
    allRows = makeRows(1);
    renderTable();

    expect(screen.getByText("1-1 of 1")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2); // header + 1 data row
  });

  it.each([
    { count: 10, footer: "1-10 of 10", totalPages: 1 },
    { count: 11, footer: "1-10 of 11", totalPages: 2 },
    { count: 25, footer: "1-10 of 25", totalPages: 3 },
    { count: 50, footer: "1-10 of 50", totalPages: 5 },
    { count: 51, footer: "1-10 of 51", totalPages: 6 },
    { count: 75, footer: "1-10 of 75", totalPages: 8 },
    { count: 200, footer: "1-10 of 200", totalPages: 20 },
  ])(
    "renders '$footer' and exactly $totalPages pages for $count matching rows -- no 50-row ceiling",
    ({ count, footer, totalPages }) => {
      allRows = makeRows(count);
      renderTable();

      expect(screen.getByText(footer)).toBeInTheDocument();
      // Real page 1 is always a full 10-row page here (count >= 10 in every case above).
      expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(11); // header + 10 rows

      const lastPageButton = screen.getByRole("button", { name: "Last page" });
      const nextPageButton = screen.getByRole("button", { name: "Next page" });
      if (totalPages > 1) {
        expect(lastPageButton).toBeEnabled();
        expect(nextPageButton).toBeEnabled();
      } else {
        expect(lastPageButton).toBeDisabled();
        expect(nextPageButton).toBeDisabled();
      }
      // Only up to 5 page-number buttons are ever shown at once (see visiblePageNumbers); never more than that regardless of true totalPages.
      const visiblePageButtons = screen.getAllByRole("button", { name: /^Page \d+$/ });
      expect(visiblePageButtons.length).toBe(Math.min(totalPages, 5));
    }
  );

  it("reaches a real, correctly-sized final partial page for 75 rows (page 8 of 10 = 5 rows), with a real range request for it", async () => {
    allRows = makeRows(75);
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Last page" }));

    expect(await screen.findByText("71-75 of 75")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(6); // header + 5 rows
    expect(useTransactionWithFiltersSpy).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 10, offset: 70 })
    );
  });

  it("reaches a real final page for 200 rows (page 20, rows 191-200) -- far beyond the old 50-row cap", async () => {
    allRows = makeRows(200);
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Last page" }));

    expect(await screen.findByText("191-200 of 200")).toBeInTheDocument();
    expect(useTransactionWithFiltersSpy).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 10, offset: 190 })
    );
  });

  it("requests a real range for an arbitrary middle page and shows only that page's rows (no client re-slice on top)", async () => {
    allRows = makeRows(25);
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Page 2" }));

    expect(await screen.findByText("11-20 of 25")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(11); // header + 10 rows
    expect(useTransactionWithFiltersSpy).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 10, offset: 10 })
    );
  });

  it("resets to page 1 when the caller's filters change", async () => {
    allRows = makeRows(25);
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrap = (filters: Filters) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <UserIdProvider value={{ userId: "test-user-id", email: "test@example.com" }}>
            <TransactionTable filters={filters} onAddTransaction={vi.fn()} onEditTransaction={vi.fn()} />
          </UserIdProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const { rerender } = render(wrap({ sortBy: "date", sortOrder: "desc" }));

    await user.click(screen.getByRole("button", { name: "Page 3" }));
    expect(await screen.findByText("21-25 of 25")).toBeInTheDocument();

    rerender(wrap({ sortBy: "date", sortOrder: "desc", search: "coffee" }));

    expect(await screen.findByText("1-10 of 25")).toBeInTheDocument();
  });

  it("changing rows-per-page resets to page 1 and requests the new page size", async () => {
    allRows = makeRows(25);
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Page 2" }));
    expect(await screen.findByText("11-20 of 25")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /rows per page/i }));
    await user.click(await screen.findByRole("option", { name: "20" }));

    expect(await screen.findByText("1-20 of 25")).toBeInTheDocument();
    expect(useTransactionWithFiltersSpy).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 20, offset: 0 })
    );
  });
});
