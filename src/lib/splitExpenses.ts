/**
 * Split Expenses -- frontend-only state/types/calculations (no Supabase).
 * See docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry for the full
 * frontend-phase writeup and the future backend architecture this state
 * shape is designed to connect to later.
 *
 * Every money value here is an integer number of CENTS, never a float
 * dollar amount -- see splitCentsEqually()'s doc comment for why, and
 * centsToDollars()/dollarsFromFormatter for the only place cents becomes a
 * display dollar amount (at render time, via the app's existing
 * useFormatCurrency()).
 */

export type ParticipantId = string;

export type Participant = {
  id: ParticipantId;
  name: string;
};

/** The fixed, non-removable participant representing the signed-in Nexali user. Always participants[0]. */
export const YOU_PARTICIPANT_ID: ParticipantId = "you";

export function makeYouParticipant(): Participant {
  return { id: YOU_PARTICIPANT_ID, name: "You" };
}

/**
 * Every item supports exactly the three conceptual ownership modes the
 * product spec calls for (Mine / Someone Else / Shared), plus an initial
 * "unassigned" state so a freshly-parsed item never silently defaults to
 * belonging to anyone. Structured as a discriminated union (not three
 * separate optional fields) so an item can never be in two modes at once,
 * and so a future custom-split feature can extend the "shared" case (e.g.
 * per-participant weights) without touching "mine"/"someone_else".
 */
export type ItemAssignment =
  | { kind: "unassigned" }
  | { kind: "mine" }
  | { kind: "someone_else"; participantId: ParticipantId | null }
  | { kind: "shared"; participantIds: ParticipantId[] };

export const UNASSIGNED: ItemAssignment = { kind: "unassigned" };

export type SplitReceiptItem = {
  id: string;
  name: string;
  /** As reported by the parser -- describes what was purchased, not how many people split it (see the task's explicit Quantity semantics). */
  quantity: number;
  /** This item's total price, in integer cents. */
  totalCents: number;
  assignment: ItemAssignment;
};

/**
 * Tax/tip/discount/fee rows exactly as the parser reports them -- shown
 * truthfully, never invented. These are NOT split between participants in
 * this frontend phase (see splitBlockReason/receiptItemsSubtotalCents doc
 * comments) -- that is explicitly future backend-designed behavior, not
 * guessed at here.
 */
export type SplitReceiptExtraRow = {
  id: string;
  label: string;
  /** Positive for tax/tip/fees, negative for a discount. */
  amountCents: number;
};

export type ReceiptStatus = "ready" | "processing" | "parsed" | "error";

export type SplitReceipt = {
  id: string;
  fileName: string;
  /** Object URL for a thumbnail preview, or null if the runtime can't create one (e.g. some test environments). Never uploaded anywhere. */
  imageUrl: string | null;
  status: ReceiptStatus;
  errorMessage: string | null;
  merchant: string | null;
  /** ISO yyyy-mm-dd, as reported by the parser. */
  purchaseDate: string | null;
  items: SplitReceiptItem[];
  extraRows: SplitReceiptExtraRow[];
  /** The full parsed total (items + extraRows), as reported by the receipt -- independent of receiptItemsSubtotalCents(), which is only the assignable/splittable portion. */
  parsedTotalCents: number | null;
  categoryId: number | null;
  categoryName: string | null;
  /** UI-only: whether this receipt's item list is collapsed, for managing several receipts at once. */
  collapsed: boolean;
};

// ============================================================================
// Money
// ============================================================================

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Deterministic equal-cents split across N participants: base = floor(total
 * / n), and the remainder (always < n cents) is distributed one cent each
 * to the first `remainder` participants in the given order. This
 * guarantees the parts always sum back to EXACTLY `totalCents` -- e.g.
 * $10.00 / 3 people -> 334 + 333 + 333 = 1000 cents, never a lost cent from
 * three independently-rounded $3.33 shares. Order is the caller-supplied
 * `participantIds` order, so the same two people always get the same
 * (deterministic, not random) extra-cent treatment for a given item.
 */
export function splitCentsEqually(totalCents: number, participantIds: ParticipantId[]): Map<ParticipantId, number> {
  const result = new Map<ParticipantId, number>();
  const n = participantIds.length;
  if (n === 0) return result;

  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  participantIds.forEach((id, index) => {
    result.set(id, base + (index < remainder ? 1 : 0));
  });
  return result;
}

/** True once an item's assignment has everything it needs to compute a real share (a person picked for "someone else", 2+ people for "shared"). */
export function isItemAssignmentComplete(assignment: ItemAssignment): boolean {
  switch (assignment.kind) {
    case "mine":
      return true;
    case "someone_else":
      return assignment.participantId != null;
    case "shared":
      return assignment.participantIds.length >= 2;
    case "unassigned":
      return false;
  }
}

/** Per-participant cents this one item contributes. Empty for an incomplete assignment -- never a guessed default owner. */
export function itemShareCents(item: SplitReceiptItem): Map<ParticipantId, number> {
  const { assignment, totalCents } = item;
  switch (assignment.kind) {
    case "mine":
      return new Map([[YOU_PARTICIPANT_ID, totalCents]]);
    case "someone_else":
      return assignment.participantId ? new Map([[assignment.participantId, totalCents]]) : new Map();
    case "shared":
      return splitCentsEqually(totalCents, assignment.participantIds);
    case "unassigned":
      return new Map();
  }
}

/**
 * The sum of this receipt's real item totals -- "the receipt total being
 * split" in the product spec's sense. Deliberately excludes extraRows
 * (tax/tip/discounts/fees): those are displayed truthfully (see
 * SplitReceiptExtraRow) but this frontend phase does not invent a
 * tax/tip-splitting rule, so they never enter the per-participant math.
 * parsedTotalCents (the full receipt total) is shown separately wherever
 * this subtotal is shown, so the two numbers are never confused.
 */
export function receiptItemsSubtotalCents(receipt: SplitReceipt): number {
  return receipt.items.reduce((sum, item) => sum + item.totalCents, 0);
}

export function receiptAssignedCents(receipt: SplitReceipt): number {
  return receipt.items
    .filter((item) => isItemAssignmentComplete(item.assignment))
    .reduce((sum, item) => sum + item.totalCents, 0);
}

export function receiptUnassignedCents(receipt: SplitReceipt): number {
  return receiptItemsSubtotalCents(receipt) - receiptAssignedCents(receipt);
}

/** Per-participant totals for ONE receipt, summed across every complete item assignment on it. */
export function receiptParticipantTotals(receipt: SplitReceipt): Map<ParticipantId, number> {
  const totals = new Map<ParticipantId, number>();
  for (const item of receipt.items) {
    for (const [participantId, cents] of itemShareCents(item)) {
      totals.set(participantId, (totals.get(participantId) ?? 0) + cents);
    }
  }
  return totals;
}

/** Per-participant totals across EVERY receipt -- the "Overall"/grand-total summary. */
export function overallParticipantTotals(receipts: SplitReceipt[]): Map<ParticipantId, number> {
  const totals = new Map<ParticipantId, number>();
  for (const receipt of receipts) {
    for (const [participantId, cents] of receiptParticipantTotals(receipt)) {
      totals.set(participantId, (totals.get(participantId) ?? 0) + cents);
    }
  }
  return totals;
}

export function overallItemsSubtotalCents(receipts: SplitReceipt[]): number {
  return receipts.reduce((sum, r) => sum + receiptItemsSubtotalCents(r), 0);
}

function participantName(participants: Participant[], id: ParticipantId): string {
  return participants.find((p) => p.id === id)?.name ?? "Unknown";
}

/** Compact trigger-button summary of one item's current assignment, e.g. "Mine", "Alex", "You + Alex", "Assign…" -- shared by AssignmentControl's trigger and its accessible label. */
export function describeAssignment(assignment: ItemAssignment, participants: Participant[]): string {
  switch (assignment.kind) {
    case "unassigned":
      return "Assign…";
    case "mine":
      return "Mine";
    case "someone_else":
      return assignment.participantId ? participantName(participants, assignment.participantId) : "Choose person…";
    case "shared":
      if (assignment.participantIds.length === 0) return "Choose people…";
      return assignment.participantIds.map((id) => participantName(participants, id)).join(" + ");
  }
}

/**
 * Formats a receipt's parsed purchase date (a plain calendar date, "as
 * printed on the receipt" -- no time-of-day, no timezone) per the user's
 * `date_format` preference. Deliberately does NOT reuse the app's
 * timezone-aware `useFormatDate()`/`formatDate()` (dateFormat.ts): that
 * function treats its input as a real instant and converts it into the
 * user's configured `profiles.timezone`, which would shift a date-only
 * value like "2026-09-15" backward a day for any negative UTC offset
 * (e.g. rendering "September 14" for a receipt printed "September 15").
 * A receipt's printed date has no instant/timezone to convert -- this
 * mirrors dateFormat.ts's own mdy/dmy/ymd pattern logic without that step.
 */
export function formatReceiptDate(iso: string, dateFormat: "mdy" | "dmy" | "ymd"): string {
  const [year, month, day] = iso.split("-");
  switch (dateFormat) {
    case "dmy":
      return `${day}/${month}/${year}`;
    case "ymd":
      return iso;
    case "mdy":
    default:
      return `${month}/${day}/${year}`;
  }
}

// ============================================================================
// Validation / Process readiness
// ============================================================================

export function isReceiptReadyToProcess(receipt: SplitReceipt): boolean {
  if (receipt.status !== "parsed") return false;
  if (receipt.categoryId == null) return false;
  return receipt.items.every((item) => isItemAssignmentComplete(item.assignment));
}

export function canProcessSplit(receipts: SplitReceipt[]): boolean {
  if (receipts.length === 0) return false;
  return receipts.every(isReceiptReadyToProcess);
}

/**
 * A short, specific, user-facing reason Process Split is disabled right
 * now -- the exact inline feedback the product spec calls for instead of
 * silently disabling the button. Returns null once everything is ready.
 * Checks receipts in order and returns the FIRST blocking reason, so the
 * user is never shown a vague "something's wrong" message.
 */
export function splitBlockReason(receipts: SplitReceipt[]): string | null {
  if (receipts.length === 0) {
    return "Add at least one receipt to start a split.";
  }
  for (const receipt of receipts) {
    const label = receipt.merchant ?? receipt.fileName;
    if (receipt.status === "processing") return `"${label}" is still processing.`;
    if (receipt.status === "error") return `"${label}" failed to parse -- remove it or add it again.`;
    if (receipt.status === "ready") return `"${label}" hasn't been parsed yet.`;
    if (receipt.categoryId == null) return `Choose a category for "${label}".`;
    const incomplete = receipt.items.find((item) => !isItemAssignmentComplete(item.assignment));
    if (incomplete) return `Assign "${incomplete.name}" on "${label}" before continuing.`;
  }
  return null;
}
