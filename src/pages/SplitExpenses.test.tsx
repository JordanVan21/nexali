import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import SplitExpenses from "./SplitExpenses";
import type { ParsedReceiptResult } from "../lib/receiptParser";
import type { NexaliUserPreview } from "../lib/friends";

const parseReceiptImageMock = vi.fn();
vi.mock("../lib/receiptParser", () => ({
  parseReceiptImage: (...args: unknown[]) => parseReceiptImageMock(...args),
}));

const GLOBAL_EXPENSE_CATEGORIES = [
  { id: 31, name: "Food And Dining" },
  { id: 40, name: "Groceries" },
];
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
  // ReceiptCard's CategoryPicker always renders with globalOnly (Split
  // Expenses requires a category safe for every participant -- see
  // CategoryPicker.tsx's own globalOnly doc comment), which sources from
  // this hook instead of useListCategories.
  useListGlobalExpenseCategories: () => ({
    data: GLOBAL_EXPENSE_CATEGORIES,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Most of this file's tests are about receipt parsing / category /
// item-assignment / process-split logic, not the real-friend picker itself
// (see FriendAutocomplete.test.tsx for its own dedicated, exhaustive unit
// coverage) -- an empty accepted-friends list keeps those tests focused,
// and every "add a second participant" interaction there goes through the
// "Add someone manually" secondary path instead. The "real friend picker
// integration"/"remove participant"/"Who Paid"/"Settlement preview"
// describe blocks below set `friendsListState` to a real fixture list for
// exactly the tests that need one.
let friendsListState: { data: NexaliUserPreview[] | undefined; isLoading: boolean; isError: boolean; error: unknown } = {
  data: [],
  isLoading: false,
  isError: false,
  error: null,
};
const friendsRefetchMock = vi.fn();
vi.mock("../features/friends/useFriendsQueries", () => ({
  useListFriends: () => ({ ...friendsListState, refetch: friendsRefetchMock }),
}));

const submitSplitExpenseMock = vi.fn();
vi.mock("../lib/splitExpensesData", () => ({
  submitSplitExpense: (...args: unknown[]) => submitSplitExpenseMock(...args),
  acceptSplitExpense: vi.fn(),
  declineSplitExpense: vi.fn(),
}));

function friend(overrides: Partial<NexaliUserPreview> = {}): NexaliUserPreview {
  return { id: "u-alex", fullName: "Alex Nguyen", email: "alex@example.com", avatarUrl: null, status: "friends", ...overrides };
}

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
 * "Add Person" now opens the real-friend autocomplete picker first (see
 * FriendAutocomplete.tsx) -- these tests aren't exercising a real friend,
 * so they go through its "Add someone manually" secondary path (the
 * pre-existing AddPersonDialog, kept as a clearly separate fallback) to add
 * a plain-name, non-Nexali participant exactly like before.
 */
async function addManualPerson(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: /^add person$/i }));
  await user.click(await screen.findByRole("button", { name: /add someone manually/i }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText(/^name$/i), name);
  await user.click(within(dialog).getByRole("button", { name: /^add person$/i }));
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
  afterEach(() => {
    vi.clearAllMocks();
    friendsListState = { data: [], isLoading: false, isError: false, error: null };
  });

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
      await addManualPerson(user, "Alex");

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

      await addManualPerson(user, "Alex");

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

    it("a valid Preview Submit calls the real submit_split_expense mutation exactly once, with the exact previewed state", async () => {
      submitSplitExpenseMock.mockResolvedValue({
        splitId: "s1",
        status: "accepted",
        currency: "USD",
        creatorTransactionCount: 1,
        participants: [{ userId: "test-user-id", position: 0, responseStatus: "accepted", allocatedTotalCents: 1645, paidTotalCents: 1645, netCents: 0 }],
        settlements: [],
      });
      const user = userEvent.setup();
      await reachPreview(user);

      await user.click(screen.getByRole("button", { name: /^submit$/i }));

      await waitFor(() => expect(submitSplitExpenseMock).toHaveBeenCalledTimes(1));
      const [payload] = submitSplitExpenseMock.mock.calls[0];
      expect(payload).toMatchObject({
        currency: "USD",
        participants: [{ userId: "test-user-id", position: 0 }],
        receipts: [
          expect.objectContaining({
            merchant: "Wendy's",
            payerUserId: "test-user-id",
            // Items subtotal (850 + 650), NOT the parsed total with tax --
            // tax/tip are not split in v1 (matches receiptItemsSubtotalCents()).
            totalCents: 1500,
          }),
        ],
      });
      expect(typeof payload.idempotencyKey).toBe("string");
    });

    it("shows a disabled/pending Submit button during submission, preventing a duplicate click", async () => {
      let resolveSubmit!: (v: unknown) => void;
      submitSplitExpenseMock.mockReturnValue(new Promise((res) => (resolveSubmit = res)));
      const user = userEvent.setup();
      await reachPreview(user);

      await user.click(screen.getByRole("button", { name: /^submit$/i }));
      expect(await screen.findByRole("button", { name: /submitting/i })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: /submitting/i }));
      expect(submitSplitExpenseMock).toHaveBeenCalledTimes(1);

      resolveSubmit({ splitId: "s1", status: "accepted", currency: "USD", creatorTransactionCount: 1, participants: [], settlements: [] });
      await screen.findByText(/split submitted/i);
    });

    it("a failed submission preserves the full Preview (every receipt/assignment still shown) and shows a safe error", async () => {
      submitSplitExpenseMock.mockRejectedValue(new Error("Split totals do not reconcile"));
      const user = userEvent.setup();
      await reachPreview(user);

      await user.click(screen.getByRole("button", { name: /^submit$/i }));

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Who owes what")).toBeInTheDocument();
      expect(screen.getAllByText("Wendy's").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /^submit$/i })).toBeEnabled();
    });

    it("retrying after a failure reuses the SAME idempotencyKey (never a fresh one)", async () => {
      submitSplitExpenseMock.mockRejectedValueOnce(new Error("network error"));
      submitSplitExpenseMock.mockResolvedValueOnce({ splitId: "s1", status: "accepted", currency: "USD", creatorTransactionCount: 1, participants: [], settlements: [] });
      const user = userEvent.setup();
      await reachPreview(user);

      await user.click(screen.getByRole("button", { name: /^submit$/i }));
      await waitFor(() => expect(submitSplitExpenseMock).toHaveBeenCalledTimes(1));
      const firstKey = submitSplitExpenseMock.mock.calls[0][0].idempotencyKey;

      await user.click(screen.getByRole("button", { name: /^submit$/i }));
      await waitFor(() => expect(submitSplitExpenseMock).toHaveBeenCalledTimes(2));
      const secondKey = submitSplitExpenseMock.mock.calls[1][0].idempotencyKey;

      expect(secondKey).toBe(firstKey);
    });

    it("shows a truthful success confirmation using the REAL server-returned counts, not a claim every transaction exists", async () => {
      submitSplitExpenseMock.mockResolvedValue({
        splitId: "s1",
        status: "submitted",
        currency: "USD",
        creatorTransactionCount: 1,
        participants: [
          { userId: "test-user-id", position: 0, responseStatus: "accepted", allocatedTotalCents: 1645, paidTotalCents: 1645, netCents: 0 },
          { userId: "u-alex", position: 1, responseStatus: "pending", allocatedTotalCents: 0, paidTotalCents: 0, netCents: 0 },
          { userId: "u-sarah", position: 2, responseStatus: "pending", allocatedTotalCents: 0, paidTotalCents: 0, netCents: 0 },
        ],
        settlements: [],
      });
      const user = userEvent.setup();
      await reachPreview(user);

      await user.click(screen.getByRole("button", { name: /^submit$/i }));

      expect(await screen.findByText(/split submitted/i)).toBeInTheDocument();
      expect(screen.getByText(/your 1 nexali transaction was created/i)).toBeInTheDocument();
      expect(screen.getByText(/2 friends still need to accept their shares/i)).toBeInTheDocument();
    });

    it("does not clear local state on success until the user starts a new split", async () => {
      submitSplitExpenseMock.mockResolvedValue({ splitId: "s1", status: "accepted", currency: "USD", creatorTransactionCount: 1, participants: [], settlements: [] });
      const user = userEvent.setup();
      await reachPreview(user);

      await user.click(screen.getByRole("button", { name: /^submit$/i }));
      await screen.findByText(/split submitted/i);

      await user.click(screen.getByRole("button", { name: /start a new split/i }));
      expect(screen.getByText(/no receipts yet/i)).toBeInTheDocument();
    });

    it("Submit is blocked with a clear message when a manually-added (non-Nexali) participant is still in the split", async () => {
      const user = userEvent.setup();
      await reachPreview(user);
      // Add a manual, non-Nexali person via the secondary path.
      await user.click(screen.getByRole("button", { name: /^edit$/i }));
      await addManualPerson(user, "Guest");
      await user.click(screen.getByRole("button", { name: /process split/i }));

      expect(screen.getByRole("button", { name: /^submit$/i })).toBeDisabled();
      expect(screen.getByText(/real nexali friends/i)).toBeInTheDocument();
      expect(submitSplitExpenseMock).not.toHaveBeenCalled();
    });
  });

  describe("real friend picker integration", () => {
    it("selecting a real accepted friend adds them to the split, showing their real name and email", async () => {
      friendsListState = { data: [friend()], isLoading: false, isError: false, error: null };
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await user.click(screen.getByRole("button", { name: /add person/i }));
      await user.click(await screen.findByRole("option", { name: /alex nguyen/i }));

      expect(screen.getByText("Alex Nguyen")).toBeInTheDocument();
      expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    });

    it("shows a safe error with Retry when the real Friends list fails to load", async () => {
      friendsListState = { data: undefined, isLoading: false, isError: true, error: new Error("down") };
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await user.click(screen.getByRole("button", { name: /add person/i }));
      expect(screen.getByRole("alert")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /retry/i }));
      expect(friendsRefetchMock).toHaveBeenCalled();
    });
  });

  describe("remove participant", () => {
    async function addAlex(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: /add person/i }));
      await user.click(await screen.findByRole("option", { name: /alex nguyen/i }));
    }

    it("removes an unreferenced friend immediately, with no confirmation dialog", async () => {
      friendsListState = { data: [friend()], isLoading: false, isError: false, error: null };
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });
      await addAlex(user);

      await user.click(screen.getByRole("button", { name: /remove alex nguyen from split/i }));

      expect(screen.queryByText("Alex Nguyen")).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("a friend assigned to an item requires confirmation, and removing them clears that assignment", async () => {
      friendsListState = { data: [friend()], isLoading: false, isError: false, error: null };
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("wendys.jpg"));
      const baconatorRow = screen.getAllByText("Baconator").map((el) => el.closest("tr")).find((el): el is HTMLTableRowElement => el != null)!;
      await addAlex(user);
      await setAssignment(user, baconatorRow, "Someone Else");
      await user.click(await screen.findByRole("option", { name: "Alex Nguyen" }));

      await user.click(screen.getByRole("button", { name: /remove alex nguyen from split/i }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/assigned to 1 item/i)).toBeInTheDocument();

      // Cancel keeps them in the split, still assigned.
      await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
      expect(screen.getByRole("button", { name: /remove alex nguyen from split/i })).toBeInTheDocument();
      expect(within(baconatorRow).getByRole("button", { name: /assignment for baconator: alex nguyen/i })).toBeInTheDocument();

      // Confirm actually removes them AND clears the stale assignment --
      // reverts to "Choose person…" (someone_else with participantId:
      // null), never silently reassigned/auto-completed.
      await user.click(screen.getByRole("button", { name: /remove alex nguyen from split/i }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^remove$/i }));

      expect(screen.queryByText("Alex Nguyen")).not.toBeInTheDocument();
      expect(within(baconatorRow).getByRole("button", { name: /assignment for baconator: choose person…/i })).toBeInTheDocument();
    });

    it("removing a friend from a Shared item drops them from participantIds -- the item becomes incomplete, never silently converted to Mine", async () => {
      friendsListState = { data: [friend()], isLoading: false, isError: false, error: null };
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("wendys.jpg"));
      const baconatorRow = screen.getAllByText("Baconator").map((el) => el.closest("tr")).find((el): el is HTMLTableRowElement => el != null)!;
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;
      await chooseCategory(user, card, "Food And Dining");
      await addAlex(user);
      await setAssignment(user, baconatorRow, "Shared");
      await user.click(screen.getByRole("checkbox", { name: /you/i }));
      await user.click(screen.getByRole("checkbox", { name: /alex nguyen/i }));
      await closeAssignmentPopover(user);
      expect(within(baconatorRow).getByRole("button", { name: /assignment for baconator: you \+ alex nguyen/i })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /remove alex nguyen from split/i }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^remove$/i }));

      // Still "shared" in intent, but with only one person left -- incomplete, not "Mine".
      expect(within(baconatorRow).queryByText(/^mine$/i)).not.toBeInTheDocument();
      expect(screen.getByText(/assign "baconator" on "wendy's" before continuing/i)).toBeInTheDocument();
    });

    it("removing a receipt's payer clears that receipt's payer -- Process Split becomes blocked again until reassigned", async () => {
      friendsListState = { data: [friend()], isLoading: false, isError: false, error: null };
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("wendys.jpg"));
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;
      await chooseCategory(user, card, "Food And Dining");
      await addAlex(user);
      await user.click(screen.getByRole("button", { name: /set all to mine/i }));

      const payerTrigger = within(card).getByLabelText(/who paid/i);
      await user.click(payerTrigger);
      await user.click(await screen.findByRole("option", { name: "Alex Nguyen" }));
      expect(within(card).getByText(/alex nguyen/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /process split/i })).toBeEnabled();

      await user.click(screen.getByRole("button", { name: /remove alex nguyen from split/i }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/payer for 1 receipt/i)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: /^remove$/i }));

      expect(screen.getByRole("button", { name: /process split/i })).toBeDisabled();
      expect(screen.getByText(/choose who paid for "wendy's"/i)).toBeInTheDocument();
    });
  });

  describe("Who Paid?", () => {
    it("shows a Who Paid? field for every receipt, defaulting to You without hiding the field", async () => {
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("wendys.jpg"));
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;

      expect(within(card).getByLabelText(/who paid/i)).toHaveTextContent("You");
    });

    it("an accepted friend can be chosen as payer once added to the split", async () => {
      friendsListState = { data: [friend()], isLoading: false, isError: false, error: null };
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("wendys.jpg"));
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;
      await user.click(screen.getByRole("button", { name: /add person/i }));
      await user.click(await screen.findByRole("option", { name: /alex nguyen/i }));

      await user.click(within(card).getByLabelText(/who paid/i));
      await user.click(await screen.findByRole("option", { name: "Alex Nguyen" }));

      expect(within(card).getByLabelText(/who paid/i)).toHaveTextContent("Alex Nguyen");
    });

    it("different receipts can have independent payers", async () => {
      friendsListState = { data: [friend()], isLoading: false, isError: false, error: null };
      parseReceiptImageMock.mockImplementation((file: File) =>
        Promise.resolve(file.name === "wendys.jpg" ? wendysFixture() : wendysFixture({ merchant: "Trader Joe's", items: [{ name: "Milk", quantity: 1, totalCents: 450 }] }))
      );
      const user = userEvent.setup();
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("wendys.jpg"), makeFile("groceries.jpg"));
      await screen.findByText("Wendy's");
      await screen.findByText("Trader Joe's");
      const wendysCard = screen.getByText("Wendy's").closest(".nexali-panel") as HTMLElement;
      const traderCard = screen.getByText("Trader Joe's").closest(".nexali-panel") as HTMLElement;

      await user.click(screen.getByRole("button", { name: /add person/i }));
      await user.click(await screen.findByRole("option", { name: /alex nguyen/i }));

      await user.click(within(wendysCard).getByLabelText(/who paid/i));
      await user.click(await screen.findByRole("option", { name: "Alex Nguyen" }));

      expect(within(wendysCard).getByLabelText(/who paid/i)).toHaveTextContent("Alex Nguyen");
      expect(within(traderCard).getByLabelText(/who paid/i)).toHaveTextContent("You");
    });
  });

  describe("Settlement preview (Who Owes Who)", () => {
    function sharedDinnerFixture(): ParsedReceiptResult {
      return {
        merchant: "Group Dinner",
        purchaseDate: "2026-09-14",
        items: [{ name: "Dinner", quantity: 1, totalCents: 6000 }],
        extraRows: [],
        totalCents: 6000,
      };
    }

    async function reachSettlementPreview(user: ReturnType<typeof userEvent.setup>, payer: "You" | "Alex Nguyen") {
      friendsListState = {
        data: [friend({ id: "u-alex", fullName: "Alex Nguyen" }), friend({ id: "u-sarah", fullName: "Sarah Le", email: "sarah@example.com" })],
        isLoading: false,
        isError: false,
        error: null,
      };
      parseReceiptImageMock.mockResolvedValue(sharedDinnerFixture());
      renderWithProviders(<SplitExpenses />, { route: "/split" });

      await uploadFiles(user, makeFile("dinner.jpg"));
      const card = (await screen.findByText("Group Dinner")).closest(".nexali-panel") as HTMLElement;
      await chooseCategory(user, card, "Food And Dining");

      await user.click(screen.getByRole("button", { name: /add person/i }));
      await user.click(await screen.findByRole("option", { name: /alex nguyen/i }));
      await user.click(screen.getByRole("button", { name: /add person/i }));
      await user.click(await screen.findByRole("option", { name: /sarah le/i }));

      const dinnerRow = screen.getAllByText("Dinner").map((el) => el.closest("tr")).find((el): el is HTMLTableRowElement => el != null)!;
      await setAssignment(user, dinnerRow, "Shared");
      await user.click(screen.getByRole("checkbox", { name: /^you$/i }));
      await user.click(screen.getByRole("checkbox", { name: /alex nguyen/i }));
      await user.click(screen.getByRole("checkbox", { name: /sarah le/i }));
      await closeAssignmentPopover(user);

      if (payer === "Alex Nguyen") {
        await user.click(within(card).getByLabelText(/who paid/i));
        await user.click(await screen.findByRole("option", { name: "Alex Nguyen" }));
      }

      await user.click(screen.getByRole("button", { name: /process split/i }));
    }

    /** The task's own worked example #1: You pay $60, three equal $20 shares. */
    it("You pay: the other two participants each owe You their $20.00 share", async () => {
      const user = userEvent.setup();
      await reachSettlementPreview(user, "You");

      expect(screen.queryByText("You owe Alex Nguyen $20.00")).not.toBeInTheDocument();
      // "you" is deliberately lowercase mid-sentence (natural English), while
      // "You" as the SENTENCE SUBJECT (the other test below) is capitalized
      // -- see describeSettlement's own unit tests in splitExpenses.test.ts.
      expect(screen.getByText("Alex Nguyen owes you $20.00")).toBeInTheDocument();
      expect(screen.getByText("Sarah Le owes you $20.00")).toBeInTheDocument();
    });

    /** The task's own worked example #2: a friend pays instead. */
    it("a friend pays: You and the other participant each owe that friend $20.00", async () => {
      const user = userEvent.setup();
      await reachSettlementPreview(user, "Alex Nguyen");

      expect(screen.getByText("You owe Alex Nguyen $20.00")).toBeInTheDocument();
      expect(screen.getByText("Sarah Le owes Alex Nguyen $20.00")).toBeInTheDocument();
    });

    it("shows 'Everyone is settled up' when there is nothing to settle", async () => {
      const user = userEvent.setup();
      parseReceiptImageMock.mockResolvedValue(wendysFixture());
      renderWithProviders(<SplitExpenses />, { route: "/split" });
      await uploadFiles(user, makeFile("wendys.jpg"));
      const card = (await screen.findByText("Wendy's")).closest(".nexali-panel") as HTMLElement;
      await chooseCategory(user, card, "Food And Dining");
      await user.click(screen.getByRole("button", { name: /set all to mine/i }));
      await user.click(screen.getByRole("button", { name: /process split/i }));

      // Solo split, You paid and You owe 100% of Your own share -- nothing to settle.
      expect(screen.getByText(/everyone is settled up/i)).toBeInTheDocument();
    });
  });
});
