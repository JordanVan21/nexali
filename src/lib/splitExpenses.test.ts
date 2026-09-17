import { describe, it, expect } from "vitest";
import {
  YOU_PARTICIPANT_ID,
  amountPaidCents,
  buildSubmitSplitExpensePayload,
  canProcessSplit,
  centsToDollars,
  computeNetBalances,
  computeSettlements,
  describeAssignment,
  describeSettlement,
  dollarsToCents,
  findParticipantReferences,
  formatReceiptDate,
  isItemAssignmentComplete,
  isParticipantReferenced,
  isReceiptReadyToProcess,
  isSubmittableToBackend,
  itemShareCents,
  makeYouParticipant,
  overallItemsSubtotalCents,
  overallParticipantTotals,
  receiptAssignedCents,
  receiptItemsSubtotalCents,
  receiptParticipantTotals,
  receiptUnassignedCents,
  removeParticipantFromReceipts,
  splitBlockReason,
  splitCentsEqually,
  UNASSIGNED,
  type ItemAssignment,
  type NetBalance,
  type Participant,
  type SplitReceipt,
  type SplitReceiptItem,
} from "./splitExpenses";

function participant(id: string, name: string, isRealNexaliUser = true): Participant {
  return { id, name, isRealNexaliUser };
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
    payerParticipantId: "payerParticipantId" in overrides ? overrides.payerParticipantId! : YOU_PARTICIPANT_ID,
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

  it("a receipt with no payer is never ready", () => {
    expect(
      isReceiptReadyToProcess(receipt({ payerParticipantId: null, items: [item({ assignment: { kind: "mine" } })] }))
    ).toBe(false);
  });

  it("a fully-assigned, categorized, parsed receipt is ready", () => {
    expect(isReceiptReadyToProcess(receipt({ items: [item({ assignment: { kind: "mine" } })] }))).toBe(true);
  });

  it("a friend can be the payer just as validly as You", () => {
    expect(
      isReceiptReadyToProcess(receipt({ payerParticipantId: "alex", items: [item({ assignment: { kind: "mine" } })] }))
    ).toBe(true);
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

  it("explains a missing payer, checked after category and before item assignment", () => {
    expect(splitBlockReason([receipt({ merchant: "Wendy's", payerParticipantId: null })])).toMatch(/who paid.*wendy's/i);
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

describe("findParticipantReferences / isParticipantReferenced", () => {
  it("an unreferenced participant has zero item references and no payer receipts", () => {
    const refs = findParticipantReferences([receipt({ items: [item({ assignment: { kind: "mine" } })] })], "alex");
    expect(refs).toEqual({ itemCount: 0, payerForReceiptIds: [] });
    expect(isParticipantReferenced(refs)).toBe(false);
  });

  it("counts a someone_else assignment as one reference", () => {
    const refs = findParticipantReferences(
      [receipt({ items: [item({ assignment: { kind: "someone_else", participantId: "alex" } })] })],
      "alex"
    );
    expect(refs.itemCount).toBe(1);
    expect(isParticipantReferenced(refs)).toBe(true);
  });

  it("counts a shared-item membership as one reference", () => {
    const refs = findParticipantReferences(
      [receipt({ items: [item({ assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex"] } })] })],
      "alex"
    );
    expect(refs.itemCount).toBe(1);
  });

  it("counts every item across every receipt they're referenced in", () => {
    const r1 = receipt({ id: "r1", items: [item({ id: "a", assignment: { kind: "someone_else", participantId: "alex" } })] });
    const r2 = receipt({
      id: "r2",
      items: [
        item({ id: "b", assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex"] } }),
        item({ id: "c", assignment: { kind: "mine" } }),
      ],
    });
    expect(findParticipantReferences([r1, r2], "alex").itemCount).toBe(2);
  });

  it("lists every receipt id where they are the payer", () => {
    const r1 = receipt({ id: "r1", payerParticipantId: "alex" });
    const r2 = receipt({ id: "r2", payerParticipantId: YOU_PARTICIPANT_ID });
    const r3 = receipt({ id: "r3", payerParticipantId: "alex" });
    const refs = findParticipantReferences([r1, r2, r3], "alex");
    expect(refs.payerForReceiptIds).toEqual(["r1", "r3"]);
    expect(isParticipantReferenced(refs)).toBe(true);
  });
});

describe("removeParticipantFromReceipts", () => {
  it("clears a someone_else owner to null -- never silently transfers to another participant", () => {
    const r = receipt({ items: [item({ id: "i1", assignment: { kind: "someone_else", participantId: "alex" } })] });
    const [result] = removeParticipantFromReceipts([r], "alex");
    expect(result.items[0].assignment).toEqual({ kind: "someone_else", participantId: null });
  });

  it("leaves an unrelated someone_else assignment untouched", () => {
    const r = receipt({ items: [item({ id: "i1", assignment: { kind: "someone_else", participantId: "sarah" } })] });
    const [result] = removeParticipantFromReceipts([r], "alex");
    expect(result.items[0].assignment).toEqual({ kind: "someone_else", participantId: "sarah" });
  });

  it("drops the removed id from a shared item's participantIds, keeping kind: shared (never silently converted to Mine)", () => {
    const r = receipt({ items: [item({ id: "i1", assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex", "sarah"] } })] });
    const [result] = removeParticipantFromReceipts([r], "alex");
    expect(result.items[0].assignment).toEqual({ kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "sarah"] });
  });

  it("a shared item dropping below 2 people becomes incomplete (isItemAssignmentComplete), not auto-converted", () => {
    const r = receipt({ items: [item({ id: "i1", assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex"] } })] });
    const [result] = removeParticipantFromReceipts([r], "alex");
    expect(result.items[0].assignment).toEqual({ kind: "shared", participantIds: [YOU_PARTICIPANT_ID] });
    expect(isItemAssignmentComplete(result.items[0].assignment)).toBe(false);
  });

  it("clears the receipt's payer to null when the removed participant was the payer", () => {
    const r = receipt({ payerParticipantId: "alex" });
    const [result] = removeParticipantFromReceipts([r], "alex");
    expect(result.payerParticipantId).toBeNull();
  });

  it("leaves an unrelated receipt's payer untouched", () => {
    const r = receipt({ payerParticipantId: YOU_PARTICIPANT_ID });
    const [result] = removeParticipantFromReceipts([r], "alex");
    expect(result.payerParticipantId).toBe(YOU_PARTICIPANT_ID);
  });

  it("leaves a mine assignment completely untouched", () => {
    const r = receipt({ items: [item({ id: "i1", assignment: { kind: "mine" } })] });
    const [result] = removeParticipantFromReceipts([r], "alex");
    expect(result.items[0].assignment).toEqual({ kind: "mine" });
  });
});

describe("amountPaidCents / computeNetBalances (allocation vs payment)", () => {
  it("amountPaidCents sums the items subtotal of every receipt this participant paid for", () => {
    const r1 = receipt({ id: "r1", payerParticipantId: "alex", items: [item({ totalCents: 2000 })] });
    const r2 = receipt({ id: "r2", payerParticipantId: "alex", items: [item({ totalCents: 500 })] });
    const r3 = receipt({ id: "r3", payerParticipantId: YOU_PARTICIPANT_ID, items: [item({ totalCents: 999 })] });
    expect(amountPaidCents([r1, r2, r3], "alex")).toBe(2500);
  });

  it("amountPaidCents is 0 for a participant who never paid anything", () => {
    expect(amountPaidCents([receipt({ payerParticipantId: YOU_PARTICIPANT_ID })], "alex")).toBe(0);
  });

  /** The task's own worked example: Peter pays $60, three equal $20 shares. */
  it("computeNetBalances: the payer's net is positive (receives), everyone else's is negative (owes)", () => {
    const alex = participant("alex", "Peter Nguyen");
    const sarah = participant("sarah", "Sarah Le");
    const r = receipt({
      payerParticipantId: "alex",
      items: [item({ totalCents: 6000, assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex", "sarah"] } })],
    });
    const balances = computeNetBalances([r], [makeYouParticipant(), alex, sarah]);
    const byId = new Map(balances.map((b) => [b.participantId, b]));

    expect(byId.get(YOU_PARTICIPANT_ID)).toEqual({ participantId: YOU_PARTICIPANT_ID, allocatedShareCents: 2000, amountPaidCents: 0, netCents: -2000 });
    expect(byId.get("alex")).toEqual({ participantId: "alex", allocatedShareCents: 2000, amountPaidCents: 6000, netCents: 4000 });
    expect(byId.get("sarah")).toEqual({ participantId: "sarah", allocatedShareCents: 2000, amountPaidCents: 0, netCents: -2000 });
  });

  it("a participant who paid but has no allocated share still gets a full positive net", () => {
    const alex = participant("alex", "Alex");
    const r = receipt({ payerParticipantId: "alex", items: [item({ totalCents: 1000, assignment: { kind: "mine" } })] });
    const balances = computeNetBalances([r], [makeYouParticipant(), alex]);
    expect(balances.find((b) => b.participantId === "alex")).toEqual({
      participantId: "alex",
      allocatedShareCents: 0,
      amountPaidCents: 1000,
      netCents: 1000,
    });
  });

  it("net balances always sum to zero once every receipt has a payer and every item is fully assigned", () => {
    const alex = participant("alex", "Alex");
    const sarah = participant("sarah", "Sarah");
    const r1 = receipt({
      id: "r1",
      payerParticipantId: YOU_PARTICIPANT_ID,
      items: [item({ totalCents: 6000, assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex", "sarah"] } })],
    });
    const r2 = receipt({
      id: "r2",
      payerParticipantId: "alex",
      items: [item({ totalCents: 3000, assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, "alex"] } })],
    });
    const balances = computeNetBalances([r1, r2], [makeYouParticipant(), alex, sarah]);
    expect(balances.reduce((sum, b) => sum + b.netCents, 0)).toBe(0);
  });
});

describe("computeSettlements (deterministic debtor/creditor matching, integer cents)", () => {
  const fmt = (d: number) => `$${d.toFixed(2)}`;

  function balance(id: string, netCents: number): NetBalance {
    return { participantId: id, allocatedShareCents: 0, amountPaidCents: 0, netCents };
  }

  /** The task's own worked example #1: You pay $60, three equal $20 shares. */
  it("one receipt, You pay: the other two each owe You their share", () => {
    const settlements = computeSettlements([balance(YOU_PARTICIPANT_ID, 4000), balance("alex", -2000), balance("sarah", -2000)]);
    expect(settlements).toEqual([
      { fromParticipantId: "alex", toParticipantId: YOU_PARTICIPANT_ID, amountCents: 2000 },
      { fromParticipantId: "sarah", toParticipantId: YOU_PARTICIPANT_ID, amountCents: 2000 },
    ]);
  });

  /** The task's own worked example #2: a friend (Peter) pays instead. */
  it("one receipt, a friend pays: You and the other participant each owe the friend", () => {
    const settlements = computeSettlements([balance("peter", 4000), balance(YOU_PARTICIPANT_ID, -2000), balance("sarah", -2000)]);
    expect(settlements).toEqual([
      { fromParticipantId: YOU_PARTICIPANT_ID, toParticipantId: "peter", amountCents: 2000 },
      { fromParticipantId: "sarah", toParticipantId: "peter", amountCents: 2000 },
    ]);
  });

  /** The task's own multi-receipt netting example: Alex owes You $20, You owe Alex $15 -> net Alex owes You $5. */
  it("nets opposing obligations across multiple receipts into a single transfer", () => {
    const settlements = computeSettlements([balance(YOU_PARTICIPANT_ID, 500), balance("alex", -500)]);
    expect(settlements).toEqual([{ fromParticipantId: "alex", toParticipantId: YOU_PARTICIPANT_ID, amountCents: 500 }]);
  });

  it("three or more debtors/creditors: produces a valid, minimal-ish set of transfers that fully settles everyone", () => {
    // You +50, Alex -20, Sarah -10, Peter -20 (two creditors would also be
    // fine here, but this specific case has exactly one creditor).
    const settlements = computeSettlements([
      balance(YOU_PARTICIPANT_ID, 5000),
      balance("alex", -2000),
      balance("sarah", -1000),
      balance("peter", -2000),
    ]);
    expect(settlements.reduce((s, x) => (x.toParticipantId === YOU_PARTICIPANT_ID ? s + x.amountCents : s), 0)).toBe(5000);
    expect(settlements.every((s) => s.toParticipantId === YOU_PARTICIPANT_ID)).toBe(true);
  });

  it("handles two creditors and two debtors with a deterministic, fully-settling match", () => {
    // You +30, Alex +20, Sarah -25, Peter -25
    const settlements = computeSettlements([
      balance(YOU_PARTICIPANT_ID, 3000),
      balance("alex", 2000),
      balance("sarah", -2500),
      balance("peter", -2500),
    ]);
    const totalTransferred = settlements.reduce((s, x) => s + x.amountCents, 0);
    expect(totalTransferred).toBe(5000); // total debt == total credit
    // Every debtor's total outgoing equals their debt; every creditor's total incoming equals their credit.
    const bySource = new Map<string, number>();
    const byTarget = new Map<string, number>();
    for (const s of settlements) {
      bySource.set(s.fromParticipantId, (bySource.get(s.fromParticipantId) ?? 0) + s.amountCents);
      byTarget.set(s.toParticipantId, (byTarget.get(s.toParticipantId) ?? 0) + s.amountCents);
    }
    expect(bySource.get("sarah")).toBe(2500);
    expect(bySource.get("peter")).toBe(2500);
    expect(byTarget.get(YOU_PARTICIPANT_ID)).toBe(3000);
    expect(byTarget.get("alex")).toBe(2000);
  });

  it("$10.00 split 3 ways rounding scenario still produces settlements that fully resolve (no lost/leftover cents)", () => {
    // 1000 cents / 3 -> 334/333/333 (splitCentsEqually); You paid, so You
    // are owed 333 (from each of the other two) since Your own 334 share
    // is already covered by having paid.
    const balances: NetBalance[] = [
      { participantId: YOU_PARTICIPANT_ID, allocatedShareCents: 334, amountPaidCents: 1000, netCents: 666 },
      { participantId: "alex", allocatedShareCents: 333, amountPaidCents: 0, netCents: -333 },
      { participantId: "sarah", allocatedShareCents: 333, amountPaidCents: 0, netCents: -333 },
    ];
    const settlements = computeSettlements(balances);
    expect(settlements.reduce((s, x) => s + x.amountCents, 0)).toBe(666);
  });

  it("a zero-balance participant never appears in any settlement", () => {
    const settlements = computeSettlements([balance(YOU_PARTICIPANT_ID, 2000), balance("alex", -2000), balance("sarah", 0)]);
    expect(settlements.some((s) => s.fromParticipantId === "sarah" || s.toParticipantId === "sarah")).toBe(false);
  });

  it("produces no settlements when everyone is already even", () => {
    expect(computeSettlements([balance(YOU_PARTICIPANT_ID, 0), balance("alex", 0)])).toEqual([]);
  });

  it("output ordering is deterministic for the same input", () => {
    const balances = [balance(YOU_PARTICIPANT_ID, 3000), balance("alex", -1000), balance("sarah", -2000)];
    expect(computeSettlements(balances)).toEqual(computeSettlements(balances));
  });

  it("describeSettlement states direction in plain text, never relying on an icon/arrow alone", () => {
    const participants = [makeYouParticipant(), participant("peter", "Peter Nguyen"), participant("sarah", "Sarah Le")];
    expect(
      describeSettlement({ fromParticipantId: YOU_PARTICIPANT_ID, toParticipantId: "peter", amountCents: 2000 }, participants, fmt)
    ).toBe("You owe Peter Nguyen $20.00");
    expect(
      describeSettlement({ fromParticipantId: "sarah", toParticipantId: "peter", amountCents: 2000 }, participants, fmt)
    ).toBe("Sarah Le owes Peter Nguyen $20.00");
    expect(
      describeSettlement({ fromParticipantId: "peter", toParticipantId: YOU_PARTICIPANT_ID, amountCents: 1250 }, participants, fmt)
    ).toBe("Peter Nguyen owes you $12.50");
  });
});

describe("isSubmittableToBackend", () => {
  it("true when every participant is a real Nexali user (You + real friends)", () => {
    expect(isSubmittableToBackend([makeYouParticipant(), participant("alex", "Alex", true)])).toBe(true);
  });

  it("false when any participant was added manually (not a real Nexali account)", () => {
    expect(isSubmittableToBackend([makeYouParticipant(), participant("temp-1", "Some Guest", false)])).toBe(false);
  });

  it("true for a creator-only split", () => {
    expect(isSubmittableToBackend([makeYouParticipant()])).toBe(true);
  });
});

describe("buildSubmitSplitExpensePayload", () => {
  const CREATOR_ID = "00000000-0000-0000-0000-0000000000c1";
  const ALEX_ID = "00000000-0000-0000-0000-0000000000a1";

  function realParticipants(): Participant[] {
    return [makeYouParticipant(), participant(ALEX_ID, "Alex Nguyen", true)];
  }

  it("replaces the local YOU_PARTICIPANT_ID placeholder with the real creatorUserId everywhere it appears", () => {
    const r = receipt({
      payerParticipantId: YOU_PARTICIPANT_ID,
      items: [item({ assignment: { kind: "mine" } })],
    });
    const payload = buildSubmitSplitExpensePayload({
      idempotencyKey: "key-1",
      currency: "USD",
      creatorUserId: CREATOR_ID,
      participants: realParticipants(),
      receipts: [r],
    });

    expect(payload.participants[0].userId).toBe(CREATOR_ID);
    expect(payload.receipts[0].payerUserId).toBe(CREATOR_ID);
    expect(payload.receipts[0].items[0].participantIds).toEqual([CREATOR_ID]);
  });

  it("keeps a real friend's own id unchanged", () => {
    const r = receipt({
      payerParticipantId: ALEX_ID,
      items: [item({ assignment: { kind: "someone_else", participantId: ALEX_ID } })],
    });
    const payload = buildSubmitSplitExpensePayload({
      idempotencyKey: "key-1",
      currency: "USD",
      creatorUserId: CREATOR_ID,
      participants: realParticipants(),
      receipts: [r],
    });

    expect(payload.receipts[0].payerUserId).toBe(ALEX_ID);
    expect(payload.receipts[0].items[0].participantIds).toEqual([ALEX_ID]);
  });

  it("sends participant position as their array index, not a stored field", () => {
    const payload = buildSubmitSplitExpensePayload({
      idempotencyKey: "key-1",
      currency: "USD",
      creatorUserId: CREATOR_ID,
      participants: realParticipants(),
      receipts: [],
    });
    expect(payload.participants).toEqual([
      { userId: CREATOR_ID, position: 0 },
      { userId: ALEX_ID, position: 1 },
    ]);
  });

  it("sends totalCents as the items subtotal (SUM of line totals), matching what the server independently recomputes and validates", () => {
    const r = receipt({
      items: [
        item({ id: "a", totalCents: 500, assignment: { kind: "mine" } }),
        item({ id: "b", totalCents: 300, assignment: { kind: "mine" } }),
      ],
    });
    const payload = buildSubmitSplitExpensePayload({
      idempotencyKey: "key-1",
      currency: "USD",
      creatorUserId: CREATOR_ID,
      participants: realParticipants(),
      receipts: [r],
    });
    expect(payload.receipts[0].totalCents).toBe(800);
  });

  it("never sends client-computed share_cents -- only raw assignmentType/participantIds for the server to recompute from", () => {
    const r = receipt({ items: [item({ assignment: { kind: "shared", participantIds: [YOU_PARTICIPANT_ID, ALEX_ID] } })] });
    const payload = buildSubmitSplitExpensePayload({
      idempotencyKey: "key-1",
      currency: "USD",
      creatorUserId: CREATOR_ID,
      participants: realParticipants(),
      receipts: [r],
    });
    const [sentItem] = payload.receipts[0].items;
    expect(Object.keys(sentItem)).not.toContain("shareCents");
    expect(sentItem.assignmentType).toBe("shared");
    expect(sentItem.participantIds).toEqual([CREATOR_ID, ALEX_ID]);
  });

  it("preserves item/receipt array order as position", () => {
    const r1 = receipt({ id: "r1", items: [item({ id: "i1" })] });
    const r2 = receipt({ id: "r2", items: [item({ id: "i2" })] });
    const payload = buildSubmitSplitExpensePayload({
      idempotencyKey: "key-1",
      currency: "USD",
      creatorUserId: CREATOR_ID,
      participants: realParticipants(),
      receipts: [r1, r2],
    });
    expect(payload.receipts[0].position).toBe(0);
    expect(payload.receipts[1].position).toBe(1);
  });

  it("carries the idempotencyKey and currency straight through unchanged", () => {
    const payload = buildSubmitSplitExpensePayload({
      idempotencyKey: "my-key-123",
      currency: "EUR",
      creatorUserId: CREATOR_ID,
      participants: realParticipants(),
      receipts: [],
    });
    expect(payload.idempotencyKey).toBe("my-key-123");
    expect(payload.currency).toBe("EUR");
  });
});
