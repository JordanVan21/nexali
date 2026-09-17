import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import { TransactionForm } from "./TransactionForm";
import { toZonedDateInputValue, occurredAtFromZonedDateInput } from "../lib/transactionDate";
import type { TransactionWithCat } from "../lib/transactions";

const TEST_TZ = "America/Los_Angeles";

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

vi.mock("../features/profiles/useProfile", () => ({
  useProfile: () => ({ data: { timezone: TEST_TZ }, isLoading: false, isError: false }),
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
  useListGlobalExpenseCategories: () => ({ data: [], isLoading: false, isFetching: false, isError: false, error: null }),
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
        occurredAt: expect.any(String),
      });
    });
    // Defaults to today (real local date), matching the visible Date field's default.
    const [{ occurredAt }] = mutateAsync.mock.calls[0];
    expect(occurredAt).toBe(occurredAtFromZonedDateInput(toZonedDateInputValue(new Date(), TEST_TZ), TEST_TZ));
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

  it("pre-fills fields, including the real Date, when editing an existing transaction", () => {
    const existingTx: TransactionWithCat = {
      id: 7,
      amount: 18.25,
      merchant: "Shell Oil",
      note: "Gas",
      created_at: "2024-03-15T00:00:00.000Z",
      occurred_at: "2024-01-01T12:00:00.000Z",
      category_id: 1,
      categories: { id: 1, name: "Groceries", type: "expense" },
    };
    renderWithProviders(<TransactionForm existingTx={existingTx} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/amount/i)).toHaveValue(18.25);
    expect(screen.getByLabelText(/merchant/i)).toHaveValue("Shell Oil");
    expect(screen.getByLabelText(/note/i)).toHaveValue("Gas");
    // The Date field loads the real financial date (occurred_at), not the
    // technical created_at -- these are deliberately different above.
    expect(screen.getByLabelText(/^date/i)).toHaveValue("2024-01-01");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("resubmitting unrelated field changes preserves the original occurred_at's real calendar date rather than overwriting it with today", async () => {
    // Built via the same local-date <-> ISO conversion the form itself
    // uses, so round-tripping through the (deliberately date-only, no
    // time-of-day UX) Date field is lossless for this fixture.
    const originalOccurredAt = occurredAtFromZonedDateInput("2024-01-01", TEST_TZ);
    const existingTx: TransactionWithCat = {
      id: 7,
      amount: 18.25,
      merchant: "Shell Oil",
      note: "Gas",
      created_at: "2024-03-15T00:00:00.000Z",
      occurred_at: originalOccurredAt,
      category_id: 1,
      categories: { id: 1, name: "Groceries", type: "expense" },
    };
    mutateAsync.mockResolvedValue({ id: 7, categoryId: 1 });
    const user = userEvent.setup();
    renderWithProviders(<TransactionForm existingTx={existingTx} onSaved={vi.fn()} onCancel={vi.fn()} />);

    // Only change the amount -- never touch the Date field.
    await user.clear(screen.getByLabelText(/amount/i));
    await user.type(screen.getByLabelText(/amount/i), "25");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const [{ occurredAt }] = mutateAsync.mock.calls[0];
    expect(occurredAt).toBe(originalOccurredAt);
  });

  it("changing the Date field updates occurred_at in the saved payload", async () => {
    const existingTx: TransactionWithCat = {
      id: 7,
      amount: 18.25,
      merchant: "Shell Oil",
      note: "Gas",
      created_at: "2024-03-15T00:00:00.000Z",
      occurred_at: "2024-01-01T12:00:00.000Z",
      category_id: 1,
      categories: { id: 1, name: "Groceries", type: "expense" },
    };
    mutateAsync.mockResolvedValue({ id: 7, categoryId: 1 });
    const user = userEvent.setup();
    renderWithProviders(<TransactionForm existingTx={existingTx} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const dateField = screen.getByLabelText(/^date/i);
    await user.clear(dateField);
    await user.type(dateField, "2024-02-14");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const [{ occurredAt }] = mutateAsync.mock.calls[0];
    expect(occurredAt).toBe(occurredAtFromZonedDateInput("2024-02-14", TEST_TZ));
  });

  it("defaults the Date field to today for a brand-new transaction", () => {
    renderWithProviders(<TransactionForm existingTx={null} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/^date/i)).toHaveValue(toZonedDateInputValue(new Date(), TEST_TZ));
  });

  it("disables the submit button while saving", () => {
    isPending = true;
    renderWithProviders(<TransactionForm existingTx={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });
});
