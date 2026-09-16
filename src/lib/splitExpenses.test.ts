import { describe, it, expect } from "vitest";
import {
  YOU_PARTICIPANT_ID,
  canProcessSplit,
  centsToDollars,
  describeAssignment,
  dollarsToCents,
  formatReceiptDate,
  isItemAssignmentComplete,
  isReceiptReadyToProcess,
  itemShareCents,
  makeYouParticipant,
  overallItemsSubtotalCents,
  overallParticipantTotals,
  receiptAssignedCents,
  receiptItemsSubtotalCents,
  receiptParticipantTotals,
  receiptUnassignedCents,
  splitBlockReason,
  splitCentsEqually,
  UNASSIGNED,
  type ItemAssignment,
  type Participant,
  type SplitReceipt,
  type SplitReceiptItem,
} from "./splitExpenses";

function participant(id: string, name: string): Participant {
  return { id, name };
}

function item(overrides: Partial<SplitReceiptItem> = {}): SplitReceiptItem {
  return {
    id: overrides.id ?? "item-1",
    name: overrides.name ?? "Item",
    quantity: overrides.quantity ?? 1,
    totalCents: overrides.totalCents ?? 1000,
    assignment: overrides.assignment ?? UNASSIGNED,
  };
}

function receipt(overrides: Partial<SplitReceipt> = {}): SplitReceipt {
  // Uses "in" (not `??`) for every field that can legitimately be
  // overridden to `null` -- `overrides.categoryId ?? 31` would silently
  // discard an explicit `categoryId: null` override, since `??` treats
  // `null` as "use the default" too.
  return {
    id: overrides.id ?? "r1",
    fileName: overrides.fileName ?? "receipt.jpg",
    imageUrl: "imageUrl" in overrides ? overrides.imageUrl! : null,
    status: overrides.status ?? "parsed",
    errorMessage: "errorMessage" in overrides ? overrides.errorMessage! : null,
    merchant: "merchant" in overrides ? overrides.merchant! : "Wendy's",
    purchaseDate: "purchaseDate" in overrides ? overrides.purchaseDate! : "2026-09-14",
    items: overrides.items ?? [],
    extraRows: overrides.extraRows ?? [],
    parsedTotalCents: "parsedTotalCents" in overrides ? overrides.parsedTotalCents! : null,
    categoryId: "categoryId" in overrides ? overrides.categoryId! : 31,
    categoryName: "categoryName" in overrides ? overrides.categoryName! : "Food And Dining",
    collapsed: overrides.collapsed ?? false,
  };
}

describe("splitCentsEqually (rounding)", () => {
  it("splits evenly when it divides exactly", () => {
    const result = splitCentsEqually(1000, ["a", "b"]);
    expect(result.get("a")).toBe(500);
    expect(result.get("b")).toBe(500);
  });

  it("$10.00 / 3 people sums to exactly 1000 cents, never losing a cent", () => {
    const result = splitCentsEqually(1000, ["a", "b", "c"]);
    const values = Array.from(result.values());
    expect(values.reduce((s, v) => s + v, 0)).toBe(1000);
    // 334 + 333 + 333, not three lossy 333s.
    expect(values).toEqual([334, 333, 333]);
  });

  it("distributes the remainder to the FIRST participants in order, deterministically", () => {
    const result = splitCentsEqually(1001, ["a", "b", "c"]);
    expect(result.get("a")).toBe(334);
    expect(result.get("b")).toBe(334);
    expect(result.get("c")).toBe(333);
  });

  it("handles a large remainder-free split across many people", () => {
    const ids = Array.from({ length: 7 }, (_, i) => `p${i}`);
    const result = splitCentsEqually(64_28, ids);
    expect(Array.from(result.values()).reduce((s, v) => s + v, 0)).toBe(64_28);
  });

  it("returns an empty map for zero participants", () => {
    expect(splitCentsEqually(1000, []).size).toBe(0);
  });
});

describe("isItemAssignmentComplete", () => {
  it("unassigned is never complete", () => {
    expect(isItemAssignmentComplete(UNASSIGNED)).toBe(false);
  });

  it("mine is always complete", () => {
    expect(isItemAssignmentComplete({ kind: "mine" })).toBe(true);
  });

  it("someone_else requires a chosen participant", () => {
    expect(isItemAssignmentComplete({ kind: "someone_else", participantId: null })).toBe(false);
    expect(isItemAssignmentComplete({ kind: "someone_else", participantId: "alex" })).toBe(true);
  });

  it("shared requires at least two participants", () => {
    expect(isItemAssignmentComplete({ kind: "shared", participantIds: [] })).toBe(false);
    expect(isItemAssignmentComplete({ kind: "shared", participantIds: ["you"] })).toBe(false);
    expect(isItemAssignmentComplete({ kind: "shared", participantIds: ["you", "alex"] })).toBe(true);
  });
});

describe("itemShareCents", () => {
  it("mine: the whole amount belongs to You", () => {
    const shares = itemShareCents(item({ totalCents: 1200, assignment: { kind: "mine" } }));
    expect(shares.get(YOU_PARTICIPANT_ID)).toBe(1200);
    expect(shares.size).toBe(1);
  });

  it("someone_else: the whole amount belongs to that person, nothing for You", () => {
    const shares = itemShareCents(item({ totalCents: 275, assignment: { kind: "someone_else", participantId: "alex" } }));
    expect(shares.get("alex")).toBe(275);
    expect(shares.has(YOU_PARTICIPANT_ID)).toBe(false);
  });

  it("someone_else with no person chosen yet contributes nothing", () => {
    const shares = itemShareCents(item({ assignment: { kind: "someone_else", participantId: null } }));
    expect(shares.size).toBe(0);
  });

  it("shared: two-person equal split", () => {
    const shares = itemShareCents(
      item({ totalCents: 1600, assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex"] } })
    );
    expect(shares.get(YOU_PARTICIPANT_ID)).toBe(800);
    expect(shares.get("alex")).toBe(800);
  });

  it("shared: three-person equal split with deterministic remainder", () => {
    const shares = itemShareCents(
      item({ totalCents: 2400, assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex", "sarah"] } })
    );
    expect(shares.get(YOU_PARTICIPANT_ID)).toBe(800);
    expect(shares.get("alex")).toBe(800);
    expect(shares.get("sarah")).toBe(800);
  });

  it("unassigned contributes nothing", () => {
    expect(itemShareCents(item({ assignment: UNASSIGNED })).size).toBe(0);
  });
});

describe("receipt-level totals", () => {
  it("items subtotal sums every item regardless of assignment state", () => {
    const r = receipt({
      items: [item({ id: "1", totalCents: 500 }), item({ id: "2", totalCents: 300, assignment: { kind: "mine" } })],
    });
    expect(receiptItemsSubtotalCents(r)).toBe(800);
  });

  it("assigned/unassigned split the subtotal correctly", () => {
    const r = receipt({
      items: [
        item({ id: "1", totalCents: 500, assignment: { kind: "mine" } }),
        item({ id: "2", totalCents: 300, assignment: UNASSIGNED }),
      ],
    });
    expect(receiptAssignedCents(r)).toBe(500);
    expect(receiptUnassignedCents(r)).toBe(300);
  });

  it("receiptParticipantTotals sums every complete item's share for this receipt only", () => {
    const r = receipt({
      items: [
        item({ id: "1", totalCents: 1200, assignment: { kind: "mine" } }),
        item({ id: "2", totalCents: 275, assignment: { kind: "someone_else", participantId: "alex" } }),
        item({ id: "3", totalCents: 850, assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex"] } }),
      ],
    });
    const totals = receiptParticipantTotals(r);
    expect(totals.get(YOU_PARTICIPANT_ID)).toBe(1200 + 425); // mine + half of 850
    expect(totals.get("alex")).toBe(275 + 425);
  });

  it("multiple items' totals combine correctly for one participant", () => {
    const r = receipt({
      items: [
        item({ id: "1", totalCents: 500, assignment: { kind: "mine" } }),
        item({ id: "2", totalCents: 700, assignment: { kind: "mine" } }),
      ],
    });
    expect(receiptParticipantTotals(r).get(YOU_PARTICIPANT_ID)).toBe(1200);
  });
});

describe("overall totals across multiple receipts", () => {
  it("sums each participant's share across every receipt (the task's own worked example)", () => {
    const r1 = receipt({
      id: "r1",
      items: [
        item({ id: "a", totalCents: 2000, assignment: { kind: "mine" } }),
        item({ id: "b", totalCents: 1000, assignment: { kind: "someone_else", participantId: "alex" } }),
      ],
    });
    const r2 = receipt({
      id: "r2",
      items: [
        item({ id: "c", totalCents: 1500, assignment: { kind: "mine" } }),
        item({ id: "d", totalCents: 500, assignment: { kind: "someone_else", participantId: "alex" } }),
        item({ id: "e", totalCents: 1200, assignment: { kind: "someone_else", participantId: "sarah" } }),
      ],
    });

    const totals = overallParticipantTotals([r1, r2]);
    expect(totals.get(YOU_PARTICIPANT_ID)).toBe(3500); // 20 + 15
    expect(totals.get("alex")).toBe(1500); // 10 + 5
    expect(totals.get("sarah")).toBe(1200);
  });

  it("participant totals across every receipt equal the sum of every receipt's own items subtotal (no leaked/lost cents)", () => {
    const r1 = receipt({
      id: "r1",
      items: [item({ id: "a", totalCents: 999, assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex", "sarah"] } })],
    });
    const r2 = receipt({
      id: "r2",
      items: [item({ id: "b", totalCents: 1234, assignment: { kind: "mine" } })],
    });

    const totals = overallParticipantTotals([r1, r2]);
    const grandTotal = Array.from(totals.values()).reduce((s, v) => s + v, 0);
    expect(grandTotal).toBe(overallItemsSubtotalCents([r1, r2]));
  });

  it("an unassigned item across receipts never silently contributes to any participant's total", () => {
    const r1 = receipt({ items: [item({ totalCents: 500, assignment: UNASSIGNED })] });
    expect(overallParticipantTotals([r1]).size).toBe(0);
  });
});

describe("isReceiptReadyToProcess / canProcessSplit", () => {
  it("a receipt still processing is never ready", () => {
    expect(isReceiptReadyToProcess(receipt({ status: "processing" }))).toBe(false);
  });

  it("a receipt with no category is never ready", () => {
    expect(isReceiptReadyToProcess(receipt({ categoryId: null }))).toBe(false);
  });

  it("a receipt with an incomplete item assignment is never ready", () => {
    expect(isReceiptReadyToProcess(receipt({ items: [item({ assignment: UNASSIGNED })] }))).toBe(false);
  });

  it("a fully-assigned, categorized, parsed receipt is ready", () => {
    expect(isReceiptReadyToProcess(receipt({ items: [item({ assignment: { kind: "mine" } })] }))).toBe(true);
  });

  it("a parsed receipt with zero items is ready once categorized (nothing to assign)", () => {
    expect(isReceiptReadyToProcess(receipt({ items: [] }))).toBe(true);
  });

  it("canProcessSplit is false with zero receipts", () => {
    expect(canProcessSplit([])).toBe(false);
  });

  it("canProcessSplit requires EVERY receipt to be ready, not just one", () => {
    const ready = receipt({ id: "ready", items: [item({ assignment: { kind: "mine" } })] });
    const notReady = receipt({ id: "not-ready", categoryId: null });
    expect(canProcessSplit([ready, notReady])).toBe(false);
    expect(canProcessSplit([ready])).toBe(true);
  });
});

describe("splitBlockReason", () => {
  it("explains zero receipts", () => {
    expect(splitBlockReason([])).toMatch(/add at least one receipt/i);
  });

  it("explains a still-processing receipt by name", () => {
    expect(splitBlockReason([receipt({ merchant: "Wendy's", status: "processing" })])).toMatch(/wendy's.*processing/i);
  });

  it("explains a parser error", () => {
    expect(splitBlockReason([receipt({ merchant: "Wendy's", status: "error" })])).toMatch(/wendy's.*failed to parse/i);
  });

  it("explains a missing category", () => {
    expect(splitBlockReason([receipt({ merchant: "Wendy's", categoryId: null })])).toMatch(/category.*wendy's/i);
  });

  it("explains the first incomplete item by name", () => {
    const reason = splitBlockReason([
      receipt({ merchant: "Wendy's", items: [item({ name: "Fries", assignment: UNASSIGNED })] }),
    ]);
    expect(reason).toMatch(/fries/i);
  });

  it("is null once everything is ready", () => {
    expect(splitBlockReason([receipt({ items: [item({ assignment: { kind: "mine" } })] })])).toBeNull();
  });
});

describe("describeAssignment", () => {
  const participants: Participant[] = [makeYouParticipant(), participant("alex", "Alex"), participant("sarah", "Sarah")];

  it.each<[ItemAssignment, string]>([
    [UNASSIGNED, "Assign…"],
    [{ kind: "mine" }, "Mine"],
    [{ kind: "someone_else", participantId: null }, "Choose person…"],
    [{ kind: "someone_else", participantId: "alex" }, "Alex"],
    [{ kind: "shared", participantIds: [] }, "Choose people…"],
    [{ kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex"] }, "You + Alex"],
  ])("describes %o as %s", (assignment, expected) => {
    expect(describeAssignment(assignment, participants)).toBe(expected);
  });
});

describe("formatReceiptDate", () => {
  it("formats mdy", () => {
    expect(formatReceiptDate("2026-09-14", "mdy")).toBe("09/14/2026");
  });

  it("formats dmy", () => {
    expect(formatReceiptDate("2026-09-14", "dmy")).toBe("14/09/2026");
  });

  it("formats ymd (unchanged ISO)", () => {
    expect(formatReceiptDate("2026-09-14", "ymd")).toBe("2026-09-14");
  });
});

describe("cents/dollars conversion", () => {
  it("round-trips exactly", () => {
    expect(centsToDollars(1234)).toBe(12.34);
    expect(dollarsToCents(12.34)).toBe(1234);
  });

  it("dollarsToCents rounds floating-point drift away", () => {
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
  });
});
