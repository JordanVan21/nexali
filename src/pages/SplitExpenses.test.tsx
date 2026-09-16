import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import SplitExpenses from "./SplitExpenses";
import type { ParsedReceiptResult } from "../lib/receiptParser";

const parseReceiptImageMock = vi.fn();
vi.mock("../lib/receiptParser", () => ({
  parseReceiptImage: (...args: unknown[]) => parseReceiptImageMock(...args),
}));

vi.mock("../features/categories/useCategories", () => ({
  useListCategories: () => ({
    data: [
      { id: 31, name: "Food And Dining", type: "expense" },
      { id: 40, name: "Groceries", type: "expense" },
    ],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function wendysFixture(overrides: Partial<ParsedReceiptResult> = {}): ParsedReceiptResult {
  return {
    merchant: "Wendy's",
    purchaseDate: "2026-09-14",
    items: [
      { name: "Baconator", quantity: 1, totalCents: 850 },
      { name: "Fries", quantity: 2, totalCents: 650 },
    ],
    extraRows: [{ label: "Sales Tax", amountCents: 145 }],
    totalCents: 1645,
    ...overrides,
  };
}

function makeFile(name: string) {
  return new File(["x"], name, { type: "image/jpeg" });
}

async function uploadFiles(user: ReturnType<typeof userEvent.setup>, ...files: File[]) {
  const input = screen.getByLabelText(/click to upload/i, { selector: "input" });
  await user.upload(input, files);
}

async function chooseCategory(user: ReturnType<typeof userEvent.setup>, container: HTMLElement, name: string) {
  await user.click(within(container).getByRole("button", { name: /category:/i }));
  await user.click(await screen.findByRole("option", { name }));
}

/**
 * Opens the AssignmentControl popover (if not already open) and picks a
 * mode. Does NOT close the popover afterward -- several tests need it to
 * stay open to pick a person/participants next. Call
 * closeAssignmentPopover() explicitly when a test needs to reopen it for
 * a second, independent interaction on the same item.
 */
async function setAssignment(
  user: ReturnType<typeof userEvent.setup>,
  itemRow: HTMLElement,
  mode: "Mine" | "Shared" | "Someone Else"
) {
  const trigger = within(itemRow).getByRole("button", { name: /assignment for/i });
  if (trigger.getAttribute("data-state") !== "open") {
    await user.click(trigger);
  }
  await user.click(await screen.findByRole("button", { name: mode }));
}

async function closeAssignmentPopover(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Escape}");
}

describe("SplitExpenses page", () => {
  afterEach(() => vi.clearAllMocks());

  it("renders the page heading and subtitle", () => {
    renderWithProviders(<SplitExpenses />, { route: "/split" });
    expect(screen.getByRole("heading", { name: "Split Expenses" })).toBeInTheDocument();
    expect(screen.getByText(/split receipt purchases fairly/i)).toBeInTheDocument();
  });

  it("shows a truthful empty state with zero receipts", () => {
    renderWithProviders(<SplitExpenses />, { route: "/split" });
    expect(screen.getByText(/no receipts yet/i)).toBeInTheDocument();
  });

  it("Process Split is disabled with zero receipts, with an inline reason", () => {
    renderWithProviders(<SplitExpenses />, { route: "/split" });
    expect(screen.getByRole("button", { name: /process split/i })).toBeDisabled();
    expect(screen.getByText(/add at least one receipt/i)).toBeInTheDocument();
  });

  it("uploading a receipt shows it Processing immediately, then Parsed with its real items", async () => {
    let resolveParse!: (v: ParsedReceiptResult) => void;
    parseReceiptImageMock.mockReturnValue(new Promise((res) => (resolveParse = res)));
    const user = userEvent.setup();
    renderWithProviders(<SplitExpenses />, { route: "/split" });

    await uploadFiles(user, makeFile("wendys.jpg"));

    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("wendys.jpg")).toBeInTheDocument();

    await waitFor(() => resolveParse(wendysFixture()));

    await screen.findByText("Parsed");
    expect(screen.getByText("Wendy's")).toBeInTheDocument();
    // Rendered in both the desktop table and the mobile stacked list at
    // once in jsdom (no real CSS media query evaluation) -- at least one
    // of each is enough to prove the real items rendered.
    expect(screen.getAllByText("Baconator").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fries").length).toBeGreaterThan(0);
  });

  it("shows a real, user-safe error state when parsing fails, and lets the user remove the receipt", async () => {
    parseReceiptImageMock.mockRejectedValue(new Error("Couldn't read this receipt image."));
    const user = userEvent.setup();
    renderWithProviders(<SplitExpenses />, { route: "/split" });

    await uploadFiles(user, makeFile("blurry.jpg"));
    await screen.findByText("Error");
    expect(screen.getByText(/couldn't read this receipt image/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove blurry.jpg/i }));
    expect(screen.queryByText("blurry.jpg")).not.toBeInTheDocument();
  });

  it("shows a truthful 'no items detected' message for a parsed receipt with zero items", async () => {
    parseReceiptImageMock.mockResolvedValue(wendysFixture({ items: [] }));
    const user = userEvent.setup();
    renderWithProviders(<SplitExpenses />, { route: "/split" });

    await uploadFiles(user, makeFile("blank.jpg"));
    await screen.findByText(/no items were detected/i);
  });

  it("supports multiple receipts, each with its own independent state", async () => {
    parseReceiptImageMock.mockImplementation((file: File) =>
      Promise.resolve(file.name === "wendys.jpg" ? wendysFixture() : wendysFixture({ merchant: "Trader Joe's", items: [{ name: "Milk", quantity: 1, totalCents: 450 }] }))
    );
    const user = userEvent.setup();
    renderWithProviders(<SplitExpenses />, { route: "/split" });

    await uploadFiles(user, makeFile("wendys.jpg"), makeFile("groceries.jpg"));

    await screen.findByText("Wendy's");
    await screen.findByText("Trader Joe's");
    expect(screen.getAllByText("Parsed")).toHaveLength(2);
  });

  describe("category selection", () => {
    it("blocks Process Split until a category is chosen, then unblocks after choosing one", async () => {
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("wendys.jpg"));
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;

      expect(screen.getByText(/choose a category for "wendy's"/i)).toBeInTheDocument();

      await chooseCategory(user, card, "Food And Dining");
      expect(screen.queryByText(/choose a category for "wendy's"/i)).not.toBeInTheDocument();
    });

    it("the chosen category persists in local state (survives other edits on the page)", async () => {
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("wendys.jpg"));
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;
      await chooseCategory(user, card, "Food And Dining");

      // Add a person, an unrelated edit -- the category selection must still hold.
      await user.click(screen.getByRole("button", { name: /add person/i }));
      await user.type(screen.getByLabelText(/^name$/i), "Alex");
      await user.click(screen.getByRole("button", { name: /^add person$/i }));

      expect(within(card).getByRole("button", { name: /category: food and dining/i })).toBeInTheDocument();
    });
  });

  describe("item assignment", () => {
    async function setupParsedReceiptWithAlex(user: ReturnType<typeof userEvent.setup>) {
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      renderWithProviders(<SplitExpenses />, { route: "/split" });
      await uploadFiles(user, makeFile("wendys.jpg"));
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;
      await chooseCategory(user, card, "Food And Dining");

      await user.click(screen.getByRole("button", { name: /add person/i }));
      await user.type(screen.getByLabelText(/^name$/i), "Alex");
      await user.click(screen.getByRole("button", { name: /^add person$/i }));

      // Both the desktop <table> row and the mobile stacked-card render
      // simultaneously in jsdom (no real CSS media query evaluation), so
      // "Baconator" appears twice -- pick the desktop <tr> specifically.
      const baconatorRow = screen.getAllByText("Baconator").map((el) => el.closest("tr")).find((el): el is HTMLTableRowElement => el != null)!;
      return { card, baconatorRow };
    }

    it("Mine assigns the full item amount to the user", async () => {
      const user = userEvent.setup();
      const { baconatorRow } = await setupParsedReceiptWithAlex(user);

      await setAssignment(user, baconatorRow, "Mine");
      expect(within(baconatorRow).getByRole("button", { name: /assignment for baconator: mine/i })).toBeInTheDocument();
      // "Mine" means the item's full price AND the calculated share both
      // read $8.50 -- two cells in the same row, both correct.
      expect(within(baconatorRow).getAllByText("$8.50")).toHaveLength(2);
    });

    it("Someone Else requires choosing a person before the assignment is complete", async () => {
      const user = userEvent.setup();
      const { baconatorRow } = await setupParsedReceiptWithAlex(user);

      await setAssignment(user, baconatorRow, "Someone Else");
      // Still incomplete -- no person chosen yet.
      expect(screen.getByText(/assign "baconator" on "wendy's" before continuing/i)).toBeInTheDocument();

      await user.click(await screen.findByRole("option", { name: "Alex" }));
      expect(within(baconatorRow).getByRole("button", { name: /assignment for baconator: alex/i })).toBeInTheDocument();
    });

    it("Shared requires at least two participants before it's complete", async () => {
      const user = userEvent.setup();
      const { baconatorRow } = await setupParsedReceiptWithAlex(user);

      await setAssignment(user, baconatorRow, "Shared");
      expect(screen.getByText(/assign "baconator" on "wendy's" before continuing/i)).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: /you/i }));
      // Still only one person -- shared needs 2+.
      expect(screen.getByText(/assign "baconator" on "wendy's" before continuing/i)).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: /alex/i }));
      expect(within(baconatorRow).getByRole("button", { name: /assignment for baconator: you \+ alex/i })).toBeInTheDocument();
    });

    it("changing assignment type resets to a fresh selection for the new mode", async () => {
      const user = userEvent.setup();
      const { baconatorRow } = await setupParsedReceiptWithAlex(user);

      await setAssignment(user, baconatorRow, "Mine");
      expect(within(baconatorRow).getByText(/^mine$/i)).toBeInTheDocument();

      await closeAssignmentPopover(user);
      await setAssignment(user, baconatorRow, "Shared");
      expect(within(baconatorRow).getByText(/choose people/i)).toBeInTheDocument();
    });
  });

  describe("Process Split validation and transition", () => {
    it("is disabled while any item is unassigned, and enabled once everything is complete", async () => {
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("wendys.jpg"));
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;
      await chooseCategory(user, card, "Food And Dining");

      expect(screen.getByRole("button", { name: /process split/i })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: /set all to mine/i }));
      expect(screen.getByRole("button", { name: /process split/i })).toBeEnabled();
    });

    it("transitions into Preview mode without ever calling Supabase (no network/mutation dependency exists on this page)", async () => {
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("wendys.jpg"));
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;
      await chooseCategory(user, card, "Food And Dining");
      await user.click(screen.getByRole("button", { name: /set all to mine/i }));
      await user.click(screen.getByRole("button", { name: /process split/i }));

      expect(screen.getByText(/who owes what/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /process split/i })).not.toBeInTheDocument();
    });
  });

  describe("Preview", () => {
    async function reachPreview(user: ReturnType<typeof userEvent.setup>) {
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      renderWithProviders(<SplitExpenses />, { route: "/split" });
      await uploadFiles(user, makeFile("wendys.jpg"));
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;
      await chooseCategory(user, card, "Food And Dining");
      await user.click(screen.getByRole("button", { name: /set all to mine/i }));
      await user.click(screen.getByRole("button", { name: /process split/i }));
    }

    it("shows the real receipt total, your amount, and a transaction preview marked ready-only", async () => {
      const user = userEvent.setup();
      await reachPreview(user);

      expect(screen.getByText("Who owes what")).toBeInTheDocument();
      expect(screen.getByText("Transaction Preview")).toBeInTheDocument();
      expect(screen.getByText("Ready to create after submission")).toBeInTheDocument();
      // $16.45 total (items 8.50 + 6.50 + 1.45 tax), all assigned to You.
      expect(screen.getAllByText("$16.45").length).toBeGreaterThan(0);
    });

    it("expands a person's breakdown to show which items make up their total", async () => {
      const user = userEvent.setup();
      await reachPreview(user);

      await user.click(screen.getByRole("button", { name: /you/i, expanded: false }));
      expect(screen.getByText("Baconator")).toBeInTheDocument();
      expect(screen.getByText("Fries")).toBeInTheDocument();
    });

    it("Edit returns to assign mode with every entered value preserved", async () => {
      const user = userEvent.setup();
      await reachPreview(user);

      await user.click(screen.getByRole("button", { name: /^edit$/i }));

      expect(screen.getByRole("button", { name: /process split/i })).toBeInTheDocument();
      const card = screen.getByText("Wendy's").closest(".nexali-panel") as HTMLElement;
      expect(within(card).getByRole("button", { name: /category: food and dining/i })).toBeInTheDocument();
    });

    it("Submit is disabled and never creates database records -- a placeholder only", async () => {
      const user = userEvent.setup();
      await reachPreview(user);

      const submitButton = screen.getByRole("button", { name: /^submit$/i });
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/backend integration pending/i)).toBeInTheDocument();
    });
  });
});
