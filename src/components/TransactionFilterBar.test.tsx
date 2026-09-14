import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import { TransactionFilterBar } from "./TransactionFilterBar";
import type { Filters } from "../features/querykeys";

vi.mock("../features/transactions/useTransactionCategoryCounts", () => ({
  useTransactionCategoryCounts: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("../features/profiles/useProfile", () => ({
  useProfile: () => ({ data: { timezone: "America/Los_Angeles" }, isLoading: false, isError: false }),
}));

vi.mock("../features/categories/useCategories", () => ({
  useListCategories: () => ({
    data: [
      { id: 1, name: "Groceries", type: "expense" },
      { id: 2, name: "Salary", type: "income" },
    ],
    isLoading: false,
  }),
}));

const BASE_FILTERS: Filters = { sortBy: "date", sortOrder: "desc" };

describe("TransactionFilterBar", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("debounces the search input before committing it to filters", async () => {
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TransactionFilterBar filters={BASE_FILTERS} onFiltersChange={onFiltersChange} />
    );

    await user.type(screen.getByRole("searchbox"), "coffee");
    expect(onFiltersChange).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(onFiltersChange).toHaveBeenCalledWith({ ...BASE_FILTERS, search: "coffee" });
      },
      { timeout: 1000 }
    );
  });

  it("does not show Reset Filters when nothing is active", () => {
    renderWithProviders(<TransactionFilterBar filters={BASE_FILTERS} onFiltersChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /reset filters/i })).not.toBeInTheDocument();
  });

  it("renders Search as its own prominent control and never an unsupported Method filter", () => {
    renderWithProviders(<TransactionFilterBar filters={BASE_FILTERS} onFiltersChange={vi.fn()} />);

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^method$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/debit|credit|automatic/i)).not.toBeInTheDocument();
  });

  it("shows Reset Filters when a filter is active and clears all filters on click", async () => {
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TransactionFilterBar
        filters={{ ...BASE_FILTERS, search: "coffee" }}
        onFiltersChange={onFiltersChange}
      />
    );

    const resetButton = screen.getByRole("button", { name: /reset filters/i });
    await user.click(resetButton);

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined, sortBy: "date", sortOrder: "desc" })
    );
  });

  it("removes an active category filter chip via its own accessible button", async () => {
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TransactionFilterBar
        filters={{ ...BASE_FILTERS, categoryNames: ["Groceries"] }}
        onFiltersChange={onFiltersChange}
      />
    );

    await user.click(screen.getByRole("button", { name: /remove category filter: groceries/i }));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ categoryNames: [] })
    );
  });

  it("lets the user toggle a category from the Category filter menu", async () => {
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TransactionFilterBar filters={BASE_FILTERS} onFiltersChange={onFiltersChange} />
    );

    await user.click(screen.getByRole("button", { name: /^category$/i }));
    await user.click(await screen.findByText("Groceries"));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ categoryNames: ["Groceries"] })
    );
  });
});
