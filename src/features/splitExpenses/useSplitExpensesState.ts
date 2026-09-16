import { useCallback, useMemo, useState } from "react";
import { parseReceiptImage } from "../../lib/receiptParser";
import {
  canProcessSplit,
  makeYouParticipant,
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

  const addParticipant = useCallback((name: string): ParticipantId => {
    const id = newId();
    setParticipants((list) => [...list, { id, name }]);
    return id;
  }, []);

  const canProcess = useMemo(() => canProcessSplit(receipts), [receipts]);
  const blockReason = useMemo(() => splitBlockReason(receipts), [receipts]);

  const process = useCallback(() => {
    if (canProcessSplit(receipts)) setMode("preview");
  }, [receipts]);

  const editSplit = useCallback(() => setMode("assign"), []);

  return {
    receipts,
    participants,
    mode,
    addReceipts,
    removeReceipt,
    toggleReceiptCollapsed,
    setReceiptCategory,
    setItemAssignment,
    setAllItemsMine,
    addParticipant,
    canProcess,
    blockReason,
    process,
    editSplit,
  };
}

export type SplitExpensesState = ReturnType<typeof useSplitExpensesState>;
