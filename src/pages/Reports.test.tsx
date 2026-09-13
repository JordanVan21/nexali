import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Reports from "./Reports";
import type { TransactionWithCat } from "../lib/transactions";
import type { Budget } from "../lib/budgets";

function isoThisMonth(day: number): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), day, 12, 0, 0).toISOString();
}

const SALARY: TransactionWithCat = {
  id: 1,
  amount: 3000,
  merchant: "Employer Inc",
  note: null,
  category_id: 9,
  created_at: isoThisMonth(1),
  categories: { id: 9, name: "Salary", type: "income" },
};

const GROCERIES: TransactionWithCat = {
  id: 2,
  amount: 150,
  merchant: "Whole Foods",
  note: null,
  category_id: 1,
  created_at: isoThisMonth(5),
  categories: { id: 1, name: "Groceries", type: "expense" },
};

let txState: { data?: TransactionWithCat[]; isLoading: boolean; isError: boolean };
let budgetsState: { data?: Budget[]; isLoading: boolean; isError: boolean };
const txRefetch = vi.fn();

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactions: () => ({ ...txState, refetch: txRefetch }),
}));

vi.mock("../features/budgets/useBudgets", () => ({
  useBudgets: () => ({ ...budgetsState, refetch: vi.fn() }),
}));

function resetToDefaults() {
  txState = { data: [SALARY, GROCERIES], isLoading: false, isError: false };
  budgetsState = { data: [], isLoading: false, isError: false };
}

describe("Reports page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page heading with no unsupported 'connected accounts' claim", () => {
    resetToDefaults();
    renderWithProviders(<Reports />);

    expect(screen.getByRole("heading", { name: "Financial Intelligence" })).toBeInTheDocument();
    expect(screen.queryByText(/connected accounts/i)).not.toBeInTheDocument();
  });

  it("shows a loading skeleton while transactions or budgets are loading", () => {
    resetToDefaults();
    txState = { data: undefined, isLoading: true, isError: false };
    renderWithProviders(<Reports />);

    expect(screen.getByLabelText("Loading reports")).toBeInTheDocument();
  });

  it("renders real income, expenses, and savings rate for the default period, not a fabricated metric", () => {
    resetToDefaults();
    renderWithProviders(<Reports />);

    const incomeCard = screen.getByText("Total Income").closest(".nexali-panel") as HTMLElement;
    expect(within(incomeCard).getByText("$3,000.00")).toBeInTheDocument();
    const expensesCard = screen.getByText("Total Expenses").closest(".nexali-panel") as HTMLElement;
    expect(within(expensesCard).getByText("$150.00")).toBeInTheDocument();
    const savingsCard = screen.getByText("Savings Rate").closest(".nexali-panel") as HTMLElement;
    expect(within(savingsCard).getByText("95.0%")).toBeInTheDocument();

    expect(screen.queryByText(/net worth/i)).not.toBeInTheDocument();
  });

  it("changes the displayed totals when the period control is changed", async () => {
    resetToDefaults();
    // 4 months back: included in the default 6-month view, excluded once the
    // period control is switched to 3 months — a real change, not a no-op.
    const fourMonthsBack = new Date();
    fourMonthsBack.setMonth(fourMonthsBack.getMonth() - 4);
    txState = {
      data: [
        GROCERIES,
        {
          id: 3,
          amount: 500,
          merchant: "Old purchase",
          note: null,
          category_id: 1,
          created_at: new Date(fourMonthsBack.getFullYear(), fourMonthsBack.getMonth(), 10, 12).toISOString(),
          categories: { id: 1, name: "Groceries", type: "expense" },
        },
      ],
      isLoading: false,
      isError: false,
    };
    const user = userEvent.setup();
    renderWithProviders(<Reports />);

    const expensesCardBefore = screen.getByText("Total Expenses").closest(".nexali-panel") as HTMLElement;
    expect(within(expensesCardBefore).getByText("$650.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "3 Months" }));

    const expensesCardAfter = screen.getByText("Total Expenses").closest(".nexali-panel") as HTMLElement;
    expect(within(expensesCardAfter).getByText("$150.00")).toBeInTheDocument();
  });

  it("shows the no-data empty state for a brand-new user with a real Add Transaction link", () => {
    resetToDefaults();
    txState = { data: [], isLoading: false, isError: false };
    renderWithProviders(<Reports />);

    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add transaction/i })).toHaveAttribute("href", "/transactions");
  });

  it("shows a retryable error state when transactions fail, rather than $0", () => {
    resetToDefaults();
    txState = { data: undefined, isLoading: false, isError: true };
    renderWithProviders(<Reports />);

    expect(screen.getByRole("heading", { name: /couldn't load your reports/i })).toBeInTheDocument();
    expect(screen.queryByText("Total Income")).not.toBeInTheDocument();
  });

  it("localizes a budgets-query failure to the budget section while transaction reports stay usable", () => {
    resetToDefaults();
    budgetsState = { data: undefined, isLoading: false, isError: true };
    renderWithProviders(<Reports />);

    expect(screen.getByRole("heading", { name: /couldn't load your budgets/i })).toBeInTheDocument();
    expect(screen.getByText("Total Income")).toBeInTheDocument();
  });

  it("shows an empty state for the spending chart when there are no expenses in the period", () => {
    resetToDefaults();
    txState = { data: [SALARY], isLoading: false, isError: false };
    renderWithProviders(<Reports />);

    expect(screen.getAllByText(/no expenses recorded for this period/i).length).toBeGreaterThan(0);
  });

  it("shows a real budget-performance empty state with a Create Budget link when no budgets exist for the period", () => {
    resetToDefaults();
    renderWithProviders(<Reports />);

    expect(screen.getByText(/no budgets were set for this period/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Budget" })).toHaveAttribute("href", "/budgets");
  });

  it("does not display a fake AI insight or prediction", () => {
    resetToDefaults();
    renderWithProviders(<Reports />);

    expect(screen.queryByText(/predicted next month/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ask aura about this trend/i })).toHaveAttribute("href", "/assistant");
  });

  it("exports the currently-displayed real transactions as CSV", async () => {
    resetToDefaults();
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL: vi.fn() });

    const user = userEvent.setup();
    renderWithProviders(<Reports />);

    await user.click(screen.getByRole("button", { name: /export csv/i }));
    expect(clickSpy).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });
});
