import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSplitExpensesState } from "./useSplitExpensesState";
import type { ParsedReceiptResult } from "../../lib/receiptParser";
import type { NexaliUserPreview } from "../../lib/friends";

const parseReceiptImageMock = vi.fn();
vi.mock("../../lib/receiptParser", () => ({
  parseReceiptImage: (...args: unknown[]) => parseReceiptImageMock(...args),
}));

function parsedFixture(overrides: Partial<ParsedReceiptResult> = {}): ParsedReceiptResult {
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

function friend(overrides: Partial<NexaliUserPreview> = {}): NexaliUserPreview {
  return { id: "u-alex", fullName: "Alex Nguyen", email: "alex@example.com", avatarUrl: null, status: "friends", ...overrides };
}

describe("useSplitExpensesState", () => {
  afterEach(() => vi.clearAllMocks());

  it("starts with zero receipts, one participant (You), and assign mode", () => {
    const { result } = renderHook(() => useSplitExpensesState());
    expect(result.current.receipts).toEqual([]);
    expect(result.current.participants).toEqual([{ id: "you", name: "You", isRealNexaliUser: true }]);
    expect(result.current.mode).toBe("assign");
    expect(result.current.canProcess).toBe(false);
  });

  it("adding a receipt shows it as processing immediately, then parsed once the parser resolves", async () => {
    let resolveParse!: (v: ParsedReceiptResult) => void;
    parseReceiptImageMock.mockReturnValue(new Promise((res) => (resolveParse = res)));

    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addReceipts([makeFile("wendys.jpg")]));

    expect(result.current.receipts).toHaveLength(1);
    expect(result.current.receipts[0].status).toBe("processing");
    expect(result.current.receipts[0].fileName).toBe("wendys.jpg");

    await act(async () => resolveParse(parsedFixture()));

    await waitFor(() => expect(result.current.receipts[0].status).toBe("parsed"));
    expect(result.current.receipts[0].merchant).toBe("Wendy's");
    expect(result.current.receipts[0].items).toHaveLength(2);
    expect(result.current.receipts[0].items[0].assignment).toEqual({ kind: "unassigned" });
    expect(result.current.receipts[0].extraRows).toEqual([{ id: expect.any(String), label: "Sales Tax", amountCents: 145 }]);
  });

  it("a parser failure sets the error status with a real message, not a fake success", async () => {
    parseReceiptImageMock.mockRejectedValue(new Error("Couldn't read this receipt image."));

    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addReceipts([makeFile("bad.jpg")]));

    await waitFor(() => expect(result.current.receipts[0].status).toBe("error"));
    expect(result.current.receipts[0].errorMessage).toMatch(/couldn't read/i);
  });

  it("multiple receipts parse independently -- one failing does not affect the other", async () => {
    parseReceiptImageMock.mockImplementation((file: File) =>
      file.name === "bad.jpg" ? Promise.reject(new Error("failed")) : Promise.resolve(parsedFixture())
    );

    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addReceipts([makeFile("good.jpg"), makeFile("bad.jpg")]));

    await waitFor(() => {
      expect(result.current.receipts.find((r) => r.fileName === "good.jpg")?.status).toBe("parsed");
      expect(result.current.receipts.find((r) => r.fileName === "bad.jpg")?.status).toBe("error");
    });
  });

  it("removeReceipt removes exactly that receipt, leaving the others", async () => {
    parseReceiptImageMock.mockResolvedValue(parsedFixture());
    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addReceipts([makeFile("a.jpg"), makeFile("b.jpg")]));
    await waitFor(() => expect(result.current.receipts).toHaveLength(2));

    const [first] = result.current.receipts;
    act(() => result.current.removeReceipt(first.id));

    expect(result.current.receipts).toHaveLength(1);
    expect(result.current.receipts[0].fileName).toBe("b.jpg");
  });

  it("toggleReceiptCollapsed flips exactly that receipt's collapsed flag", async () => {
    parseReceiptImageMock.mockResolvedValue(parsedFixture());
    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addReceipts([makeFile("a.jpg")]));
    await waitFor(() => expect(result.current.receipts[0].status).toBe("parsed"));

    const id = result.current.receipts[0].id;
    expect(result.current.receipts[0].collapsed).toBe(false);
    act(() => result.current.toggleReceiptCollapsed(id));
    expect(result.current.receipts[0].collapsed).toBe(true);
  });

  it("setReceiptCategory persists the chosen category on that receipt", async () => {
    parseReceiptImageMock.mockResolvedValue(parsedFixture());
    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addReceipts([makeFile("a.jpg")]));
    await waitFor(() => expect(result.current.receipts[0].status).toBe("parsed"));

    const id = result.current.receipts[0].id;
    act(() => result.current.setReceiptCategory(id, 31, "Food And Dining"));

    expect(result.current.receipts[0].categoryId).toBe(31);
    expect(result.current.receipts[0].categoryName).toBe("Food And Dining");
  });

  it("setItemAssignment updates exactly that item on that receipt", async () => {
    parseReceiptImageMock.mockResolvedValue(parsedFixture());
    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addReceipts([makeFile("a.jpg")]));
    await waitFor(() => expect(result.current.receipts[0].items).toHaveLength(2));

    const receiptId = result.current.receipts[0].id;
    const [item0, item1] = result.current.receipts[0].items;
    act(() => result.current.setItemAssignment(receiptId, item0.id, { kind: "mine" }));

    expect(result.current.receipts[0].items[0].assignment).toEqual({ kind: "mine" });
    expect(result.current.receipts[0].items[1].id).toBe(item1.id);
    expect(result.current.receipts[0].items[1].assignment).toEqual({ kind: "unassigned" });
  });

  it("setAllItemsMine assigns every item on that receipt to Mine in one call", async () => {
    parseReceiptImageMock.mockResolvedValue(parsedFixture());
    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addReceipts([makeFile("a.jpg")]));
    await waitFor(() => expect(result.current.receipts[0].items).toHaveLength(2));

    act(() => result.current.setAllItemsMine(result.current.receipts[0].id));
    expect(result.current.receipts[0].items.every((i) => i.assignment.kind === "mine")).toBe(true);
  });

  it("addParticipant adds a new person and returns their id", () => {
    const { result } = renderHook(() => useSplitExpensesState());
    let newId = "";
    act(() => {
      newId = result.current.addParticipant("Alex");
    });

    expect(result.current.participants).toHaveLength(2);
    expect(result.current.participants[1]).toEqual({ id: newId, name: "Alex", isRealNexaliUser: false });
  });

  it("addFriendParticipant adds a real friend using THEIR real user id, carrying email/avatar through", () => {
    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addFriendParticipant(friend({ id: "u-alex", fullName: "Alex Nguyen", email: "alex@example.com" })));

    expect(result.current.participants).toHaveLength(2);
    expect(result.current.participants[1]).toEqual({
      id: "u-alex",
      name: "Alex Nguyen",
      email: "alex@example.com",
      avatarUrl: null,
      isRealNexaliUser: true,
    });
  });

  it("addFriendParticipant is a no-op if that friend is already in the split (no duplicate)", () => {
    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addFriendParticipant(friend({ id: "u-alex" })));
    act(() => result.current.addFriendParticipant(friend({ id: "u-alex" })));

    expect(result.current.participants).toHaveLength(2);
  });

  describe("removeParticipant", () => {
    it("You can never be removed", () => {
      const { result } = renderHook(() => useSplitExpensesState());
      act(() => result.current.removeParticipant("you"));
      expect(result.current.participants).toEqual([{ id: "you", name: "You", isRealNexaliUser: true }]);
    });

    it("removes an unreferenced participant cleanly", () => {
      const { result } = renderHook(() => useSplitExpensesState());
      act(() => result.current.addFriendParticipant(friend({ id: "u-alex" })));
      act(() => result.current.removeParticipant("u-alex"));
      expect(result.current.participants).toEqual([{ id: "you", name: "You", isRealNexaliUser: true }]);
    });

    it("clears a someone_else assignment that referenced the removed participant, across all receipts", async () => {
      parseReceiptImageMock.mockResolvedValue(parsedFixture());
      const { result } = renderHook(() => useSplitExpensesState());
      act(() => result.current.addFriendParticipant(friend({ id: "u-alex" })));
      act(() => result.current.addReceipts([makeFile("a.jpg")]));
      await waitFor(() => expect(result.current.receipts[0].items).toHaveLength(2));
      const receiptId = result.current.receipts[0].id;
      const itemId = result.current.receipts[0].items[0].id;
      act(() => result.current.setItemAssignment(receiptId, itemId, { kind: "someone_else", participantId: "u-alex" }));

      act(() => result.current.removeParticipant("u-alex"));

      expect(result.current.receipts[0].items[0].assignment).toEqual({ kind: "someone_else", participantId: null });
    });

    it("removes the participant from a shared assignment, and it becomes incomplete once below 2 people", async () => {
      parseReceiptImageMock.mockResolvedValue(parsedFixture());
      const { result } = renderHook(() => useSplitExpensesState());
      act(() => result.current.addFriendParticipant(friend({ id: "u-alex" })));
      act(() => result.current.addReceipts([makeFile("a.jpg")]));
      await waitFor(() => expect(result.current.receipts[0].items).toHaveLength(2));
      const receiptId = result.current.receipts[0].id;
      const itemId = result.current.receipts[0].items[0].id;
      act(() => result.current.setItemAssignment(receiptId, itemId, { kind: "shared", participantIds: ["you", "u-alex"] }));

      act(() => result.current.removeParticipant("u-alex"));

      expect(result.current.receipts[0].items[0].assignment).toEqual({ kind: "shared", participantIds: ["you"] });
    });

    it("clears a receipt's payer if the removed participant was the payer -- the receipt becomes incomplete", async () => {
      parseReceiptImageMock.mockResolvedValue(parsedFixture());
      const { result } = renderHook(() => useSplitExpensesState());
      act(() => result.current.addFriendParticipant(friend({ id: "u-alex" })));
      act(() => result.current.addReceipts([makeFile("a.jpg")]));
      await waitFor(() => expect(result.current.receipts[0].items).toHaveLength(2));
      const receiptId = result.current.receipts[0].id;
      act(() => result.current.setReceiptPayer(receiptId, "u-alex"));
      expect(result.current.receipts[0].payerParticipantId).toBe("u-alex");

      act(() => result.current.removeParticipant("u-alex"));

      expect(result.current.receipts[0].payerParticipantId).toBeNull();
    });

    it("never calls any real Friends RPC (e.g. remove_friend) -- removal is local Split Expenses state only", async () => {
      const { supabase } = await import("../../supabaseClient");
      const rpcSpy = vi.spyOn(supabase, "rpc");
      const { result } = renderHook(() => useSplitExpensesState());
      act(() => result.current.addFriendParticipant(friend({ id: "u-alex" })));
      act(() => result.current.removeParticipant("u-alex"));
      expect(rpcSpy).not.toHaveBeenCalled();
      rpcSpy.mockRestore();
    });
  });

  describe("setReceiptPayer", () => {
    it("a newly added receipt defaults its payer to You", async () => {
      parseReceiptImageMock.mockResolvedValue(parsedFixture());
      const { result } = renderHook(() => useSplitExpensesState());
      act(() => result.current.addReceipts([makeFile("a.jpg")]));
      expect(result.current.receipts[0].payerParticipantId).toBe("you");
    });

    it("sets exactly the given receipt's payer to a real participant id, leaving other receipts untouched", async () => {
      parseReceiptImageMock.mockResolvedValue(parsedFixture());
      const { result } = renderHook(() => useSplitExpensesState());
      act(() => result.current.addFriendParticipant(friend({ id: "u-alex" })));
      act(() => result.current.addReceipts([makeFile("a.jpg"), makeFile("b.jpg")]));
      await waitFor(() => expect(result.current.receipts).toHaveLength(2));
      const [r1, r2] = result.current.receipts;

      act(() => result.current.setReceiptPayer(r1.id, "u-alex"));

      expect(result.current.receipts.find((r) => r.id === r1.id)?.payerParticipantId).toBe("u-alex");
      expect(result.current.receipts.find((r) => r.id === r2.id)?.payerParticipantId).toBe("you");
    });
  });

  it("canProcess/blockReason reflect real readiness and update as assignments complete", async () => {
    parseReceiptImageMock.mockResolvedValue(parsedFixture());
    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addReceipts([makeFile("a.jpg")]));
    await waitFor(() => expect(result.current.receipts[0].items).toHaveLength(2));

    expect(result.current.canProcess).toBe(false);
    expect(result.current.blockReason).toMatch(/category/i);

    const receiptId = result.current.receipts[0].id;
    act(() => result.current.setReceiptCategory(receiptId, 31, "Food And Dining"));
    expect(result.current.blockReason).toMatch(/baconator|fries/i);

    act(() => result.current.setAllItemsMine(receiptId));
    expect(result.current.canProcess).toBe(true);
    expect(result.current.blockReason).toBeNull();
  });

  it("process() switches to preview mode only when the split is actually valid", async () => {
    const { result } = renderHook(() => useSplitExpensesState());

    act(() => result.current.process());
    expect(result.current.mode).toBe("assign"); // zero receipts -- still blocked

    parseReceiptImageMock.mockResolvedValue(parsedFixture());
    act(() => result.current.addReceipts([makeFile("a.jpg")]));
    await waitFor(() => expect(result.current.receipts[0].items).toHaveLength(2));
    act(() => result.current.setReceiptCategory(result.current.receipts[0].id, 31, "Food And Dining"));
    act(() => result.current.setAllItemsMine(result.current.receipts[0].id));

    act(() => result.current.process());
    expect(result.current.mode).toBe("preview");
  });

  it("editSplit returns to assign mode without losing any entered state", async () => {
    parseReceiptImageMock.mockResolvedValue(parsedFixture());
    const { result } = renderHook(() => useSplitExpensesState());
    act(() => result.current.addReceipts([makeFile("a.jpg")]));
    await waitFor(() => expect(result.current.receipts[0].items).toHaveLength(2));
    act(() => result.current.setReceiptCategory(result.current.receipts[0].id, 31, "Food And Dining"));
    act(() => result.current.setAllItemsMine(result.current.receipts[0].id));
    act(() => result.current.process());
    expect(result.current.mode).toBe("preview");

    act(() => result.current.editSplit());

    expect(result.current.mode).toBe("assign");
    expect(result.current.receipts[0].categoryId).toBe(31);
    expect(result.current.receipts[0].items.every((i) => i.assignment.kind === "mine")).toBe(true);
  });

  describe("idempotencyKey", () => {
    async function reachPreview(result: { current: ReturnType<typeof useSplitExpensesState> }) {
      parseReceiptImageMock.mockResolvedValue(parsedFixture());
      act(() => result.current.addReceipts([makeFile("a.jpg")]));
      await waitFor(() => expect(result.current.receipts[0].items).toHaveLength(2));
      act(() => result.current.setReceiptCategory(result.current.receipts[0].id, 31, "Food And Dining"));
      act(() => result.current.setAllItemsMine(result.current.receipts[0].id));
      act(() => result.current.process());
    }

    it("is null before the split has ever been processed", () => {
      const { result } = renderHook(() => useSplitExpensesState());
      expect(result.current.idempotencyKey).toBeNull();
    });

    it("is generated once entering Preview, and stays the SAME across repeated Preview renders (a retry of the same attempt)", async () => {
      const { result } = renderHook(() => useSplitExpensesState());
      await reachPreview(result);

      const firstKey = result.current.idempotencyKey;
      expect(firstKey).toEqual(expect.any(String));
      expect(firstKey).not.toBe("");

      // Re-reading it (simulating a retried Submit click) must not change it.
      expect(result.current.idempotencyKey).toBe(firstKey);
    });

    it("a fresh key is generated for a genuinely new attempt (Edit, then Process again)", async () => {
      const { result } = renderHook(() => useSplitExpensesState());
      await reachPreview(result);
      const firstKey = result.current.idempotencyKey;

      act(() => result.current.editSplit());
      act(() => result.current.process());

      expect(result.current.idempotencyKey).not.toBe(firstKey);
    });
  });

  describe("resetSplit", () => {
    it("clears receipts, participants (back to just You), and mode/idempotencyKey after a successful submission", async () => {
      const { result } = renderHook(() => useSplitExpensesState());
      act(() => result.current.addFriendParticipant(friend({ id: "u-alex" })));
      parseReceiptImageMock.mockResolvedValue(parsedFixture());
      act(() => result.current.addReceipts([makeFile("a.jpg")]));
      await waitFor(() => expect(result.current.receipts[0].items).toHaveLength(2));
      act(() => result.current.setReceiptCategory(result.current.receipts[0].id, 31, "Food And Dining"));
      act(() => result.current.setAllItemsMine(result.current.receipts[0].id));
      act(() => result.current.process());

      act(() => result.current.resetSplit());

      expect(result.current.receipts).toEqual([]);
      expect(result.current.participants).toEqual([{ id: "you", name: "You", isRealNexaliUser: true }]);
      expect(result.current.mode).toBe("assign");
      expect(result.current.idempotencyKey).toBeNull();
    });
  });
});
