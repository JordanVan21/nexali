import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteTransaction,
  upsertTransaction,
  type TxId,
  transactionsWithFilters,
  fetchAllTransactionsWithFilters,
} from "../../lib/transactions";
import { resolveCategoryId } from "../../lib/categories";
import { qk, normalizeFilters, normalizeExportFilters, type Filters } from "../querykeys";

const STALE_TIME_MS = 60_000;

// Types
export type SaveVars = {
  existingId?: TxId;
  name: string;
  type: "income" | "expense";
  amount: number;
  merchant: string | null;
  note: string | null;
  /** Real financial transaction date (ISO), from the form's Date field. */
  occurredAt: string;
};

// Helper used multiple times for validation
const validateAmount = (amount: number): void => {
  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a valid number");
  }
  if (amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }
  if (amount > 999999999) {
    throw new Error("Amount is too large");
  }
};

// Helper used multiple times for query invalidation. Every server-side
// financial aggregate (Backend Parts 4 and 5) is derived from transaction
// data, so a transaction add/edit/delete must invalidate all of them, not
// just the raw search/export queries -- or the Dashboard/Reports/Budgets
// summaries and the Transactions page's own category-count badges/activity
// analytics would silently go stale after every mutation (a real bug found
// during Backend Part 4, re-verified here for the two aggregates this Part
// adds). The *Root keys intentionally invalidate every cached variant
// (every reports period/category, every budgets year/month, every activity
// date-range) via TanStack Query's prefix matching.
const invalidateRelatedQueries = async (qc: ReturnType<typeof useQueryClient>, userId: string) => {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.txRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.dashboardSummary(userId) }),
    qc.invalidateQueries({ queryKey: qk.reportsSummaryRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.budgetsProgressRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.categoryCounts(userId) }),
    qc.invalidateQueries({ queryKey: qk.activitySummaryRoot(userId) }),
  ]);
};

export function useDeleteTransaction(userId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, TxId>({
    mutationFn: async (id) => {
      if (!id) {
        throw new Error("Transaction ID is required");
      }
      return deleteTransaction(id, userId);
    },

    onError: (error, id) => {
      console.error(`Failed to delete transaction ${id}:`, error);
    },

    onSettled: async () => {
      await invalidateRelatedQueries(qc, userId);
    },
  });
}

export function useSaveTransaction(userId: string) {
  const qc = useQueryClient();

  return useMutation<{ id: TxId; categoryId: number }, Error, SaveVars>({
    mutationFn: async (vars) => {
      if (!vars.name?.trim()) {
        throw new Error("Transaction name is required");
      }

      if (!["income", "expense"].includes(vars.type)) {
        throw new Error(`Invalid transaction type: ${vars.type}. Must be 'income' or 'expense'`);
      }

      validateAmount(vars.amount);

      // Consistent merchant validation (trim first, then check length)
      const trimmedMerchant = vars.merchant?.trim() || null;
      if (trimmedMerchant && trimmedMerchant.length > 500) {
        throw new Error("Merchant cannot exceed 500 characters");
      }

      // Consistent note validation (trim first, then check length)
      const trimmedNote = vars.note?.trim() || null;
      if (trimmedNote && trimmedNote.length > 500) {
        throw new Error("Note cannot exceed 500 characters");
      }

      // Resolve category and save transaction
      const categoryId = await resolveCategoryId({
        name: vars.name.trim(),
        type: vars.type,
        userId,
      });

      const result = await upsertTransaction({
        existingId: vars.existingId,
        userId,
        categoryId,
        amount: vars.amount,
        merchant: trimmedMerchant,
        note: trimmedNote,
        occurredAt: vars.occurredAt,
      });

      return { ...result, categoryId };
    },

    onError: (error, vars) => {
      const action = vars.existingId ? "update" : "create";
      console.error(`Failed to ${action} transaction:`, error);
    },

    onSettled: async () => {
      await invalidateRelatedQueries(qc, userId);
    },
  });
}

/** Real server-paginated page of transactions for the current filters -- see transactionsWithFilters. */
export function useTransactionWithFilters(userId: string, filters: Filters) {
  const normalizedFilters = normalizeFilters(filters);
  return useQuery({
    queryKey: qk.txSearch(userId, normalizedFilters),
    queryFn: () => transactionsWithFilters(userId, normalizedFilters),
    enabled: !!userId,
    staleTime: STALE_TIME_MS,
  });
}

/** Every transaction matching the current filters (no page cap) -- CSV export only. */
export function useExportTransactionsWithFilters(userId: string, filters: Filters) {
  const normalizedFilters = normalizeExportFilters(filters);
  return useQuery({
    queryKey: qk.txExport(userId, normalizedFilters),
    queryFn: () => fetchAllTransactionsWithFilters(userId, normalizedFilters),
    enabled: !!userId,
    staleTime: STALE_TIME_MS,
  });
}
