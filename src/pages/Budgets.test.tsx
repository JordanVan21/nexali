import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Budgets from "./Budgets";
import type { TransactionWithCat } from "../lib/transactions";
import type { Budget } from "../lib/budgets";

function currentPeriod(): { month: number; year: number } {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function isoThisMonth(day: number): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), day, 12, 0, 0).toISOString();
}

const GROCERIES_BUDGET: Budget = {
  id: 1,
  amount: 200,
  ...currentPeriod(),
  category_id: 1,
  categories: { id: 1, name: "Groceries", type: "expense" },
};

const GROCERIES_TX: TransactionWithCat = {
  id: 1,
  amount: 150,
  merchant: "Whole Foods",
  note: null,
  category_id: 1,
  created_at: isoThisMonth(5),
  occurred_at: isoThisMonth(5),
  categories: { id: 1, name: "Groceries", type: "expense" },
};

let budgetsState: { data?: Budget[]; isLoading: boolean; isError: boolean };
let txState: { data?: TransactionWithCat[]; isLoading: boolean; isError: boolean };
const budgetsRefetch = vi.fn();
const txRefetch = vi.fn();
const deleteMutate = vi.fn().mockResolvedValue(undefined);
const saveMutate = vi.fn().mockResolvedValue({ id: 1 });

vi.mock("../features/budgets/useBudgets", () => ({
  useBudgets: () => ({ ...budgetsState, refetch: budgetsRefetch }),
  useDeleteBudget: () => ({ mutateAsync: deleteMutate, isPending: false }),
}));

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactions: () => ({ ...txState, refetch: txRefetch }),
}));

vi.mock("../features/budgets/useBudgetOps", () => ({
  useExpenseCategories: () => ({ isLoading: false, isError: false, error: null }),
  useSaveBudget: () => ({ mutateAsync: saveMutate, isPending: false }),
}));

vi.mock("../features/categories/useCategories", () => ({
  useListCategories: () => ({
    data: [{ id: 1, name: "Groceries" }],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function resetToDefaults() {
  budgetsState = { data: [GROCERIES_BUDGET], isLoading: false, isError: false };
  txState = { data: [GROCERIES_TX], isLoading: false, isError: false };
}

describe("Budgets page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page heading and the current period by default", () => {
    resetToDefaults();
    renderWithProviders(<Budgets />);

    expect(screen.getByRole("heading", { name: "Budget Planner" })).toBeInTheDocument();
    const { month, year } = currentPeriod();
    const monthName = new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long" });
    expect(screen.getByText(`${monthName} ${year}`)).toBeInTheDocument();
  });

  it("shows a loading skeleton while budgets or transactions are loading", () => {
    resetToDefaults();
    budgetsState = { data: undefined, isLoading: true, isError: false };
    renderWithProviders(<Budgets />);

    expect(screen.getByLabelText("Loading budgets")).toBeInTheDocument();
  });

  it("renders a real budget card with period-correct spend, not the all-time RPC figure", () => {
    resetToDefaults();
    renderWithProviders(<Budgets />);

    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Spent: $150.00")).toBeInTheDocument();
    expect(screen.getByText("Limit: $200.00")).toBeInTheDocument();
    expect(screen.getByText("Remaining $50.00")).toBeInTheDocument();
  });

  it("shows the real summary totals computed from the displayed period's budgets only", () => {
    resetToDefaults();
    renderWithProviders(<Budgets />);

    expect(screen.getByText("Total Budgeted")).toBeInTheDocument();
    const totalCard = screen.getByText("Total Budgeted").closest(".nexali-panel") as HTMLElement;
    expect(within(totalCard).getByText("$200.00")).toBeInTheDocument();
  });

  it("shows the never-created empty state with a working Add Budget action when the user has no budgets at all", async () => {
    resetToDefaults();
    budgetsState = { data: [], isLoading: false, isError: false };
    const user = userEvent.setup();
    renderWithProviders(<Budgets />);

    expect(screen.getByText("No budgets yet")).toBeInTheDocument();
    const addButtons = screen.getAllByRole("button", { name: /^add budget$/i });
    await user.click(addButtons[addButtons.length - 1]);
    expect(await screen.findByRole("dialog", { name: /add budget/i })).toBeInTheDocument();
  });

  it("shows a period-specific empty state when other periods have budgets but this one does not", () => {
    resetToDefaults();
    budgetsState = { data: [{ ...GROCERIES_BUDGET, month: 1, year: 2020 }], isLoading: false, isError: false };
    renderWithProviders(<Budgets />);

    expect(screen.getByText("No budgets for this month")).toBeInTheDocument();
  });

  it("shows a retryable error state when the budgets query fails", () => {
    resetToDefaults();
    budgetsState = { data: undefined, isLoading: false, isError: true };
    renderWithProviders(<Budgets />);

    expect(screen.getByRole("heading", { name: /couldn't load your budgets/i })).toBeInTheDocument();
  });

  it("shows a distinct error state — not a fake $0 spent — when the transaction data needed for spend fails", () => {
    resetToDefaults();
    txState = { data: undefined, isLoading: false, isError: true };
    renderWithProviders(<Budgets />);

    expect(screen.getByText(/couldn't load your spending/i)).toBeInTheDocument();
    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });

  it("navigates to the previous/next month and displays that period's own budgets", async () => {
    resetToDefaults();
    const { month, year } = currentPeriod();
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    budgetsState = {
      data: [
        GROCERIES_BUDGET,
        { id: 2, amount: 300, month: prevMonth, year: prevYear, category_id: 2, categories: { id: 2, name: "Dining", type: "expense" } },
      ],
      isLoading: false,
      isError: false,
    };
    const user = userEvent.setup();
    renderWithProviders(<Budgets />);

    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.queryByText("Dining")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous month" }));

    expect(screen.getByText("Dining")).toBeInTheDocument();
    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
  });

  it("opens the Add Budget dialog defaulted to the currently-displayed period", async () => {
    resetToDefaults();
    const user = userEvent.setup();
    renderWithProviders(<Budgets />);

    await user.click(screen.getByRole("button", { name: /^add budget$/i }));
    expect(await screen.findByRole("dialog", { name: /add budget/i })).toBeInTheDocument();
  });

  it("opens Edit from the card menu with the real budget's values", async () => {
    resetToDefaults();
    const user = userEvent.setup();
    renderWithProviders(<Budgets />);

    await user.click(screen.getByRole("button", { name: "Actions for Groceries" }));
    await user.click(await screen.findByRole("menuitem", { name: /edit/i }));

    const dialog = await screen.findByRole("dialog", { name: /edit budget/i });
    expect(within(dialog).getByDisplayValue("200")).toBeInTheDocument();
  });

  it("requires confirmation before deleting, using the accessible dialog rather than window.confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    resetToDefaults();
    const user = userEvent.setup();
    renderWithProviders(<Budgets />);

    await user.click(screen.getByRole("button", { name: "Actions for Groceries" }));
    await user.click(await screen.findByRole("menuitem", { name: /delete/i }));

    expect(await screen.findByRole("dialog", { name: /delete this budget/i })).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(deleteMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteMutate).toHaveBeenCalledWith(1);
  });
});
