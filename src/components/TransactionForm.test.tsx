import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import { TransactionForm } from "./TransactionForm";
import type { TransactionWithCat } from "../lib/transactions";

const mutateAsync = vi.fn();
let isPending = false;
let isError = false;
let error: Error | null = null;

vi.mock("../features/transactions/useTransactions", () => ({
  useSaveTransaction: () => ({
    mutateAsync,
    get isPending() {
      return isPending;
    },
    get isError() {
      return isError;
    },
    get error() {
      return error;
    },
  }),
}));

vi.mock("../features/categories/useCategories", () => ({
  useListCategories: () => ({
    data: [
      { id: 1, name: "Groceries", type: "expense" },
      { id: 2, name: "Salary", type: "income" },
    ],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

async function selectCategory(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: /^category:/i }));
  await user.click(await screen.findByRole("option", { name }));
}

describe("TransactionForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
    isPending = false;
    isError = false;
    error = null;
  });

  it("requires an amount greater than zero before saving", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderWithProviders(<TransactionForm existingTx={null} onSaved={onSaved} onCancel={vi.fn()} />);

    await selectCategory(user, "Groceries");
    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    expect(await screen.findByText(/enter an amount greater than zero/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("requires a category before saving", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionForm existingTx={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/amount/i), "42.50");
    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    expect(await screen.findByText(/choose or create a category/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("submits the expected payload for a new transaction", async () => {
    mutateAsync.mockResolvedValue({ id: 1, categoryId: 1 });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderWithProviders(<TransactionForm existingTx={null} onSaved={onSaved} onCancel={vi.fn()} />);

    await selectCategory(user, "Groceries");
    await user.type(screen.getByLabelText(/amount/i), "42.5");
    await user.type(screen.getByLabelText(/merchant/i), "Whole Foods");
    await user.type(screen.getByLabelText(/note/i), "Weekly shop");
    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        existingId: undefined,
        name: "Groceries",
        type: "expense",
        amount: 42.5,
        merchant: "Whole Foods",
        note: "Weekly shop",
      });
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("shows the mutation error and keeps the entered values so nothing is lost", async () => {
    // The mock's isError/error flip after the rejection, mirroring the real
    // hook's mutation state once it settles.
    mutateAsync.mockImplementation(async () => {
      isError = true;
      error = new Error("Amount is too large");
      throw error;
    });
    const user = userEvent.setup();
    const onSaved = vi.fn();

    renderWithProviders(<TransactionForm existingTx={null} onSaved={onSaved} onCancel={vi.fn()} />);

    await selectCategory(user, "Salary");
    await user.type(screen.getByLabelText(/amount/i), "999999999999");
    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(onSaved).not.toHaveBeenCalled();

    // Any further state update re-renders the form and re-reads the
    // now-failed mutation state, the same way a real component would after
    // TanStack Query flips isError on its next render.
    await user.type(screen.getByLabelText(/note/i), " ");

    expect(await screen.findByText(/amount is too large/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toHaveValue(999999999999);
    expect(screen.getByRole("button", { name: /^category:/i })).toHaveTextContent("Salary");
  });

  it("pre-fills fields when editing an existing transaction", () => {
    const existingTx: TransactionWithCat = {
      id: 7,
      amount: 18.25,
      merchant: "Shell Oil",
      note: "Gas",
      created_at: "2024-01-01T00:00:00.000Z",
      category_id: 1,
      categories: { id: 1, name: "Groceries", type: "expense" },
    };
    renderWithProviders(<TransactionForm existingTx={existingTx} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/amount/i)).toHaveValue(18.25);
    expect(screen.getByLabelText(/merchant/i)).toHaveValue("Shell Oil");
    expect(screen.getByLabelText(/note/i)).toHaveValue("Gas");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("disables the submit button while saving", () => {
    isPending = true;
    renderWithProviders(<TransactionForm existingTx={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });
});
