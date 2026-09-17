import { useCallback, useMemo, useState } from "react";
import { parseReceiptImage } from "../../lib/receiptParser";
import { toSplitParticipant } from "../../lib/friends";
import type { NexaliUserPreview } from "../../lib/friends";
import {
  YOU_PARTICIPANT_ID,
  canProcessSplit,
  makeYouParticipant,
  removeParticipantFromReceipts,
  splitBlockReason,
  UNASSIGNED,
  type ItemAssignment,
  type Participant,
  type ParticipantId,
  type SplitReceipt,
} from "../../lib/splitExpenses";

type SplitMode = "assign" | "preview";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeObjectUrl(file: File): string | null {
  try {
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      return URL.createObjectURL(file);
    }
  } catch {
    // Some test/runtime environments don't implement this -- a missing
    // thumbnail is a cosmetic gap, never a reason to fail the upload.
  }
  return null;
}

/**
 * All Split Expenses frontend state, in page-local React state only --
 * nothing here is persisted to Supabase (see splitExpenses.ts's module
 * doc). One receipt's parsing runs independently of the others, so
 * uploading several receipts at once shows each one's own real
 * processing/parsed/error state rather than blocking on the slowest file.
 */
export function useSplitExpensesState() {
  const [receipts, setReceipts] = useState<SplitReceipt[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([makeYouParticipant()]);
  const [mode, setMode] = useState<SplitMode>("assign");

  const updateReceipt = useCallback((id: string, patch: Partial<SplitReceipt>) => {
    setReceipts((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addReceipts = useCallback((files: File[]) => {
    const entries: SplitReceipt[] = files.map((file) => ({
      id: newId(),
      fileName: file.name,
      imageUrl: safeObjectUrl(file),
      status: "processing",
      errorMessage: null,
      merchant: null,
      purchaseDate: null,
      items: [],
      extraRows: [],
      parsedTotalCents: null,
      categoryId: null,
      categoryName: null,
      // Sensible v1 default (the signed-in user is the likely receipt
      // owner) -- never hidden, always editable via the receipt's own
      // Who Paid? control (see ReceiptCard.tsx).
      payerParticipantId: YOU_PARTICIPANT_ID,
      collapsed: false,
    }));
    setReceipts((list) => [...list, ...entries]);

    // Each file's own parse runs and resolves independently -- a slow or
    // failing receipt never blocks the others from reaching "parsed".
    files.forEach((file, index) => {
      const receiptId = entries[index].id;
      parseReceiptImage(file)
        .then((parsed) => {
          setReceipts((list) =>
            list.map((r) =>
              r.id === receiptId
                ? {
                    ...r,
                    status: "parsed",
                    merchant: parsed.merchant,
                    purchaseDate: parsed.purchaseDate,
                    parsedTotalCents: parsed.totalCents,
                    items: parsed.items.map((item) => ({
                      id: newId(),
                      name: item.name,
                      quantity: item.quantity,
                      totalCents: item.totalCents,
                      assignment: UNASSIGNED,
                    })),
                    extraRows: parsed.extraRows.map((row) => ({ id: newId(), label: row.label, amountCents: row.amountCents })),
                  }
                : r
            )
          );
        })
        .catch((err: unknown) => {
          setReceipts((list) =>
            list.map((r) =>
              r.id === receiptId
                ? { ...r, status: "error", errorMessage: err instanceof Error ? err.message : "Failed to parse this receipt." }
                : r
            )
          );
        });
    });
  }, []);

  const removeReceipt = useCallback((id: string) => {
    setReceipts((list) => {
      const target = list.find((r) => r.id === id);
      if (target?.imageUrl) {
        try {
          URL.revokeObjectURL(target.imageUrl);
        } catch {
          // Best-effort cleanup only.
        }
      }
      return list.filter((r) => r.id !== id);
    });
  }, []);

  const toggleReceiptCollapsed = useCallback((id: string) => {
    setReceipts((list) => list.map((r) => (r.id === id ? { ...r, collapsed: !r.collapsed } : r)));
  }, []);

  const setReceiptCategory = useCallback(
    (id: string, categoryId: number, categoryName: string) => {
      updateReceipt(id, { categoryId, categoryName });
    },
    [updateReceipt]
  );

  const setItemAssignment = useCallback((receiptId: string, itemId: string, assignment: ItemAssignment) => {
    setReceipts((list) =>
      list.map((r) =>
        r.id === receiptId
          ? { ...r, items: r.items.map((item) => (item.id === itemId ? { ...item, assignment } : item)) }
          : r
      )
    );
  }, []);

  /** Bulk action: every item on this receipt becomes "Mine" in one step. */
  const setAllItemsMine = useCallback((receiptId: string) => {
    setReceipts((list) =>
      list.map((r) =>
        r.id === receiptId ? { ...r, items: r.items.map((item) => ({ ...item, assignment: { kind: "mine" } })) } : r
      )
    );
  }, []);

  /**
   * "Add someone manually" -- a non-Nexali participant, name only (see
   * AddPersonDialog). Kept as a secondary path alongside real-friend
   * selection, not removed -- but `isRealNexaliUser: false` means this
   * split can never be submitted to the real backend while they remain in
   * it (see isSubmittableToBackend() in lib/splitExpenses.ts): there is no
   * real Supabase account for submit_split_expense to validate/notify/
   * create a transaction for.
   */
  const addParticipant = useCallback((name: string): ParticipantId => {
    const id = newId();
    setParticipants((list) => [...list, { id, name, isRealNexaliUser: false }]);
    return id;
  }, []);

  /** Adds a real accepted friend using THEIR real user id as the participant id (never a freshly generated one) -- a no-op if they're already in the split, so a stray double-click/double-select can never add the same friend twice. */
  const addFriendParticipant = useCallback((friend: NexaliUserPreview) => {
    setParticipants((list) => (list.some((p) => p.id === friend.id) ? list : [...list, toSplitParticipant(friend)]));
  }, []);

  /**
   * Removes this participant from the current split ONLY -- local state
   * only, never calls the real Friends remove_friend RPC and never alters
   * the actual friendship (see lib/friendsData.ts, untouched by this
   * function). "You" can never be removed. Every reference to this
   * participant (item assignments, receipt payers) is cleaned up in the
   * same update via removeParticipantFromReceipts(), so no stale id is
   * ever left behind -- see that function's own doc comment for exactly
   * how each assignment kind is handled.
   */
  const removeParticipant = useCallback((participantId: ParticipantId) => {
    if (participantId === YOU_PARTICIPANT_ID) return;
    setParticipants((list) => list.filter((p) => p.id !== participantId));
    setReceipts((list) => removeParticipantFromReceipts(list, participantId));
  }, []);

  const setReceiptPayer = useCallback(
    (receiptId: string, participantId: ParticipantId) => {
      updateReceipt(receiptId, { payerParticipantId: participantId });
    },
    [updateReceipt]
  );

  const canProcess = useMemo(() => canProcessSplit(receipts), [receipts]);
  const blockReason = useMemo(() => splitBlockReason(receipts), [receipts]);

  // Generated once per submission ATTEMPT (i.e. once per transition into
  // Preview), then reused across every retry of that SAME attempt
  // (repeated Submit clicks, a failed request retried) so the backend's
  // idempotency check can recognize a retry and never create a duplicate
  // split. Edit -> Process again is a genuinely new attempt (possibly with
  // edited content) and gets a fresh key.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const process = useCallback(() => {
    if (canProcessSplit(receipts)) {
      setIdempotencyKey(newId());
      setMode("preview");
    }
  }, [receipts]);

  const editSplit = useCallback(() => setMode("assign"), []);

  /** After a successful real submission, clears everything back to a fresh split -- the just-submitted one is now a real, persisted backend record (not something this page's local state needs to keep showing). */
  const resetSplit = useCallback(() => {
    setReceipts([]);
    setParticipants([makeYouParticipant()]);
    setMode("assign");
    setIdempotencyKey(null);
  }, []);

  return {
    receipts,
    participants,
    mode,
    idempotencyKey,
    resetSplit,
    addReceipts,
    removeReceipt,
    toggleReceiptCollapsed,
    setReceiptCategory,
    setItemAssignment,
    setAllItemsMine,
    addParticipant,
    addFriendParticipant,
    removeParticipant,
    setReceiptPayer,
    canProcess,
    blockReason,
    process,
    editSplit,
  };
}

export type SplitExpensesState = ReturnType<typeof useSplitExpensesState>;
