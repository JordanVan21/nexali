/**
 * Split Expenses -- state/types/calculations. Everything in this file is
 * pure and Supabase-free EXCEPT buildSubmitSplitExpensePayload(), which
 * shapes this local state into the wire payload for the real
 * submit_split_expense() RPC (src/lib/splitExpensesData.ts actually calls
 * it) -- see docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry for the
 * full backend writeup. The frontend's own settlement preview
 * (computeNetBalances/computeSettlements below) remains purely
 * informational once submitted -- the server independently recomputes
 * everything and its response is authoritative.
 *
 * Every money value here is an integer number of CENTS, never a float
 * dollar amount -- see splitCentsEqually()'s doc comment for why, and
 * centsToDollars()/dollarsFromFormatter for the only place cents becomes a
 * display dollar amount (at render time, via the app's existing
 * useFormatCurrency()).
 */

export type ParticipantId = string;

/**
 * `email`/`avatarUrl` are optional -- present (possibly null) for a
 * participant added from the real Friends list via `toSplitParticipant()`
 * (lib/friends.ts), absent for "You" and for a manually-added
 * non-Nexali person (AddPersonDialog), which only ever has a name. Kept as
 * the SAME stable id used everywhere else a friend is referenced
 * (item assignments, payer, preview, settlement) -- never a second,
 * parallel representation of the same person.
 *
 * `isRealNexaliUser` distinguishes "You" and a real accepted friend (both
 * `true`, both backed by a real Supabase auth user id submit_split_expense
 * can validate/create a notification or transaction for) from a
 * manually-added, non-Nexali person (`false` -- `id` is only a
 * client-generated placeholder with no corresponding Nexali account).
 * Backend submission requires every participant to be `true` -- see
 * isSubmittableToBackend() below and SplitPreview.tsx's Submit gating.
 */
export type Participant = {
  id: ParticipantId;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  isRealNexaliUser: boolean;
};

/** The fixed, non-removable participant representing the signed-in Nexali user. Always participants[0]. */
export const YOU_PARTICIPANT_ID: ParticipantId = "you";

export function makeYouParticipant(): Participant {
  return { id: YOU_PARTICIPANT_ID, name: "You", isRealNexaliUser: true };
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
  /**
   * Who fronted the money for this receipt -- exactly one payer per
   * receipt in v1 (no split-payment support). `null` until explicitly
   * chosen; a receipt is never ready to process without one (see
   * isReceiptReadyToProcess). Defaults to YOU_PARTICIPANT_ID on a newly
   * added receipt (see useSplitExpensesState's addReceipts) since the
   * signed-in user is the likely receipt owner, but stays fully editable
   * and is never hidden even when defaulted.
   */
  payerParticipantId: ParticipantId | null;
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
  if (receipt.payerParticipantId == null) return false;
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
    if (receipt.payerParticipantId == null) return `Choose who paid for "${label}".`;
    const incomplete = receipt.items.find((item) => !isItemAssignmentComplete(item.assignment));
    if (incomplete) return `Assign "${incomplete.name}" on "${label}" before continuing.`;
  }
  return null;
}

// ============================================================================
// Removing a participant from the current split (local state only -- never
// calls the real Friends `remove_friend` RPC; see useSplitExpensesState.ts's
// removeParticipant). Every place a participant id can be stored --
// "someone_else" owner, "shared" membership, a receipt's payer -- must be
// cleaned up together so a removal can never leave a stale id pointing at a
// participant that no longer exists in `participants`.
// ============================================================================

/** Where a participant is currently referenced, so the UI can decide whether removal needs confirmation and what to tell the user. */
export type ParticipantReferences = {
  /** Item count where this participant is the "someone_else" owner or a member of a "shared" group. */
  itemCount: number;
  /** Receipt ids where this participant is currently the payer. */
  payerForReceiptIds: string[];
};

export function findParticipantReferences(receipts: SplitReceipt[], participantId: ParticipantId): ParticipantReferences {
  let itemCount = 0;
  const payerForReceiptIds: string[] = [];
  for (const receipt of receipts) {
    if (receipt.payerParticipantId === participantId) payerForReceiptIds.push(receipt.id);
    for (const item of receipt.items) {
      if (item.assignment.kind === "someone_else" && item.assignment.participantId === participantId) itemCount++;
      else if (item.assignment.kind === "shared" && item.assignment.participantIds.includes(participantId)) itemCount++;
    }
  }
  return { itemCount, payerForReceiptIds };
}

export function isParticipantReferenced(refs: ParticipantReferences): boolean {
  return refs.itemCount > 0 || refs.payerForReceiptIds.length > 0;
}

/**
 * Applies a participant's removal across every receipt: a "someone_else"
 * item they owned reverts to an unresolved owner (null, never silently
 * transferred to another participant); a "shared" item they were part of
 * keeps its "shared" kind but drops their id -- if that leaves fewer than 2
 * people, isItemAssignmentComplete() already treats it as incomplete, so
 * there is no need to special-case "convert to Mine" here (and this
 * deliberately never does that). A receipt where they were the payer has
 * its payer cleared to null -- never left pointing at a removed participant.
 */
export function removeParticipantFromReceipts(receipts: SplitReceipt[], participantId: ParticipantId): SplitReceipt[] {
  return receipts.map((receipt) => ({
    ...receipt,
    payerParticipantId: receipt.payerParticipantId === participantId ? null : receipt.payerParticipantId,
    items: receipt.items.map((item) => {
      if (item.assignment.kind === "someone_else" && item.assignment.participantId === participantId) {
        return { ...item, assignment: { kind: "someone_else" as const, participantId: null } };
      }
      if (item.assignment.kind === "shared" && item.assignment.participantIds.includes(participantId)) {
        return {
          ...item,
          assignment: { kind: "shared" as const, participantIds: item.assignment.participantIds.filter((id) => id !== participantId) },
        };
      }
      return item;
    }),
  }));
}

// ============================================================================
// Payment settlement -- keeps ALLOCATION (who is responsible for each item,
// via itemShareCents/overallParticipantTotals above) strictly separate from
// PAYMENT (who actually paid at checkout). A participant's allocated share
// is not what they "owe" if they were also the one who paid -- see
// computeNetBalances's doc comment.
// ============================================================================

/** Sum of the (item-subtotal) amount this participant personally paid, across every receipt where they were the payer. Uses receiptItemsSubtotalCents (the amount actually being split), not parsedTotalCents, so paid and allocated totals reconcile exactly once every receipt has a payer and every item is assigned. */
export function amountPaidCents(receipts: SplitReceipt[], participantId: ParticipantId): number {
  return receipts
    .filter((r) => r.payerParticipantId === participantId)
    .reduce((sum, r) => sum + receiptItemsSubtotalCents(r), 0);
}

export type NetBalance = {
  participantId: ParticipantId;
  /** What this participant is responsible for (allocation). */
  allocatedShareCents: number;
  /** What this participant actually fronted at checkout (payment). */
  amountPaidCents: number;
  /** amountPaidCents - allocatedShareCents. Positive: should RECEIVE money. Negative: OWES money. Zero: settled. */
  netCents: number;
};

/** One balance per participant, in the given participants' order (deterministic). */
export function computeNetBalances(receipts: SplitReceipt[], participants: Participant[]): NetBalance[] {
  const allocated = overallParticipantTotals(receipts);
  return participants.map((p) => {
    const paid = amountPaidCents(receipts, p.id);
    const share = allocated.get(p.id) ?? 0;
    return { participantId: p.id, allocatedShareCents: share, amountPaidCents: paid, netCents: paid - share };
  });
}

export type Settlement = {
  fromParticipantId: ParticipantId;
  toParticipantId: ParticipantId;
  amountCents: number;
};

/**
 * Deterministic debtor/creditor matching ("settle up" algorithm): walk
 * debtors and creditors in their given (stable participant) order, and at
 * each step transfer the minimum of the current debtor's remaining debt and
 * the current creditor's remaining credit, advancing whichever side hits
 * zero first. Produces at most (participants with a nonzero balance - 1)
 * transfers, and the transferred amounts always sum back to exactly the
 * total debt -- integer cents only, never floating-point money. Requires
 * the input balances to already sum to zero (guaranteed once every receipt
 * has exactly one payer and every item is fully assigned -- see
 * amountPaidCents's doc comment); a caller with an incomplete split should
 * not be computing settlements yet (canProcessSplit gates this in the UI).
 */
export function computeSettlements(balances: NetBalance[]): Settlement[] {
  const debtors = balances.filter((b) => b.netCents < 0).map((b) => ({ id: b.participantId, remaining: -b.netCents }));
  const creditors = balances.filter((b) => b.netCents > 0).map((b) => ({ id: b.participantId, remaining: b.netCents }));

  const settlements: Settlement[] = [];
  let di = 0;
  let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];
    const amount = Math.min(debtor.remaining, creditor.remaining);
    if (amount > 0) {
      settlements.push({ fromParticipantId: debtor.id, toParticipantId: creditor.id, amountCents: amount });
      debtor.remaining -= amount;
      creditor.remaining -= amount;
    }
    if (debtor.remaining === 0) di++;
    if (creditor.remaining === 0) ci++;
  }
  return settlements;
}

/** "You owe Peter $20.00" / "Alex owes you $12.50" -- settlement direction is always stated in plain text, never communicated by an arrow/icon alone. */
export function describeSettlement(
  settlement: Settlement,
  participants: Participant[],
  formatCurrency: (dollars: number) => string
): string {
  const fromIsYou = settlement.fromParticipantId === YOU_PARTICIPANT_ID;
  const toIsYou = settlement.toParticipantId === YOU_PARTICIPANT_ID;
  const from = fromIsYou ? "You" : participantName(participants, settlement.fromParticipantId);
  const to = toIsYou ? "you" : participantName(participants, settlement.toParticipantId);
  const verb = fromIsYou ? "owe" : "owes";
  return `${from} ${verb} ${to} ${formatCurrency(centsToDollars(settlement.amountCents))}`;
}

// ============================================================================
// Real backend submission -- see src/lib/splitExpensesData.ts for the
// actual submit_split_expense() RPC call, and useSplitExpensesState.ts for
// idempotencyKey lifecycle (generated once per submission attempt,
// preserved across retries of the SAME attempt).
// ============================================================================

/**
 * A split can only be submitted to the real backend once every participant
 * is a real Nexali account ("You" or a real accepted friend added via
 * FriendAutocomplete) -- submit_split_expense() has no way to represent a
 * manually-added, non-Nexali person (no real user id to validate/notify/
 * create a transaction for). The manual "Add someone manually" capability
 * itself is intentionally preserved (informal/offline splitting still
 * works), but a split containing one is blocked from real submission until
 * they're removed.
 */
export function isSubmittableToBackend(participants: Participant[]): boolean {
  return participants.every((p) => p.isRealNexaliUser);
}

export type SubmitSplitExpensePayload = {
  idempotencyKey: string;
  currency: string;
  participants: { userId: string; position: number }[];
  receipts: {
    merchant: string | null;
    receiptDate: string;
    categoryId: number;
    payerUserId: string;
    position: number;
    totalCents: number;
    items: {
      description: string;
      quantity: number;
      lineTotalCents: number;
      position: number;
      assignmentType: "mine" | "someone_else" | "shared";
      participantIds: string[];
    }[];
  }[];
};

export type SubmitSplitExpenseParticipantResult = {
  userId: string;
  position: number;
  responseStatus: "pending" | "accepted" | "declined";
  allocatedTotalCents: number;
  paidTotalCents: number;
  netCents: number;
};

export type SubmitSplitExpenseResult = {
  splitId: string;
  status: "submitted" | "accepted" | "needs_attention";
  currency: string;
  creatorTransactionCount: number;
  participants: SubmitSplitExpenseParticipantResult[];
  settlements: Settlement[];
};

function itemAssignmentParticipantIds(assignment: ItemAssignment): ParticipantId[] {
  switch (assignment.kind) {
    case "mine":
      return [YOU_PARTICIPANT_ID];
    case "someone_else":
      return assignment.participantId ? [assignment.participantId] : [];
    case "shared":
      return assignment.participantIds;
    case "unassigned":
      return [];
  }
}

/**
 * Shapes the current, already-previewed local state into the exact wire
 * payload submit_split_expense() expects (see
 * docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry for the documented
 * shape) -- never sends client-computed totals/settlements, only the raw
 * items/assignments/payer choices the server independently recomputes
 * from. `receiptDate`/`categoryId`/`payerParticipantId` are asserted
 * non-null because canProcessSplit() (gating whether Preview/Submit is
 * even reachable) already guarantees every receipt has them.
 *
 * `creatorUserId` (the real, authenticated auth.uid()) replaces every
 * occurrence of the frontend's local YOU_PARTICIPANT_ID ("you") placeholder
 * -- the server only ever knows real Supabase user ids, never this app's
 * internal placeholder string.
 */
export function buildSubmitSplitExpensePayload(args: {
  idempotencyKey: string;
  currency: string;
  creatorUserId: string;
  participants: Participant[];
  receipts: SplitReceipt[];
}): SubmitSplitExpensePayload {
  const { idempotencyKey, currency, creatorUserId, participants, receipts } = args;
  const toRealId = (id: ParticipantId): string => (id === YOU_PARTICIPANT_ID ? creatorUserId : id);

  return {
    idempotencyKey,
    currency,
    participants: participants.map((p, index) => ({ userId: toRealId(p.id), position: index })),
    receipts: receipts.map((receipt, receiptIndex) => ({
      merchant: receipt.merchant,
      receiptDate: receipt.purchaseDate!,
      categoryId: receipt.categoryId!,
      payerUserId: toRealId(receipt.payerParticipantId!),
      position: receiptIndex,
      totalCents: receiptItemsSubtotalCents(receipt),
      items: receipt.items.map((item, itemIndex) => ({
        description: item.name,
        quantity: item.quantity,
        lineTotalCents: item.totalCents,
        position: itemIndex,
        // canProcessSplit() already guarantees every item is complete
        // (never "unassigned") before Submit is reachable.
        assignmentType: item.assignment.kind as "mine" | "someone_else" | "shared",
        participantIds: itemAssignmentParticipantIds(item.assignment).map(toRealId),
      })),
    })),
  };
}
