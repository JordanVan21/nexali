import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSplitExpensesState } from "./useSplitExpensesState";
import type { ParsedReceiptResult } from "../../lib/receiptParser";

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

describe("useSplitExpensesState", () => {
  afterEach(() => vi.clearAllMocks());

  it("starts with zero receipts, one participant (You), and assign mode", () => {
    const { result } = renderHook(() => useSplitExpensesState());
    expect(result.current.receipts).toEqual([]);
    expect(result.current.participants).toEqual([{ id: "you", name: "You" }]);
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
    expect(result.current.participants[1]).toEqual({ id: newId, name: "Alex" });
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
});
