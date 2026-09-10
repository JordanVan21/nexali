import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTransactions, deleteTransaction, upsertTransaction, type TxId, type TransactionWithCat, transactionsWithFilters } from "../../lib/transactions";
import { resolveCategoryId } from "../../lib/categories";
import { qk, normalizeFilters, type Filters } from "../querykeys";

// Constants
const OPTIMISTIC_CATEGORY_ID = -1;
const STALE_TIME_MS = 60_000;

// Types
export type SaveVars = {
  existingId?: TxId;
  name: string;
  type: "income" | "expense";
  amount: number;
  merchant: string | null;
  note: string | null;
};

type MutationContext = {
  prev: TransactionWithCat[] | undefined;
  optimisticId?: TxId;
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

// Helper used multiple times for query invalidation
const invalidateRelatedQueries = async (qc: ReturnType<typeof useQueryClient>, userId: string) => {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.txRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.totals(userId) }),
    qc.invalidateQueries({ queryKey: qk.spentRoot(userId) }),
  ]);
};

export function useTransactions(userId: string) {
  return useQuery({
    queryKey: qk.transactions(userId),
    queryFn: () => fetchTransactions(userId),
    staleTime: STALE_TIME_MS,
    enabled: !!userId,
  });
}

export function useDeleteTransaction(userId: string) {
  const qc = useQueryClient();
  
  return useMutation<void, Error, TxId, MutationContext>({
    mutationFn: async (id) => {
      if (!id) {
        throw new Error("Transaction ID is required");
      }
      return deleteTransaction(id, userId);
    },
    
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await qc.cancelQueries({ queryKey: qk.transactions(userId) });
      
      // Get previous data for rollback
      const prev = qc.getQueryData<TransactionWithCat[]>(qk.transactions(userId));
      
      // Optimistically remove the transaction
      qc.setQueryData<TransactionWithCat[]>(qk.transactions(userId), (old = []) =>
        old.filter((t) => t.id !== id)
      );
      
      return { prev };
    },
    
    onError: (error, id, context) => {
      // Rollback on error
      if (context?.prev) {
        qc.setQueryData(qk.transactions(userId), context.prev);
      }
      console.error(`Failed to delete transaction ${id}:`, error);
    },
    
    onSettled: async () => {
      await invalidateRelatedQueries(qc, userId);
    },
  });
}

export function useSaveTransaction(userId: string) {
  const qc = useQueryClient();
  
  return useMutation<
    { id: TxId; categoryId: number }, 
    Error, 
    SaveVars, 
    MutationContext
  >({
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
        merchant: trimmedMerchant, // Add this line
        note: trimmedNote,
      });
      
      return { ...result, categoryId };
    },
    
    onMutate: async (vars) => {
      // Cancel any outgoing refetches
      await qc.cancelQueries({ queryKey: qk.transactions(userId) });
      
      // Get previous data for rollback
      const prev = qc.getQueryData<TransactionWithCat[]>(qk.transactions(userId));
      
      // Create optimistic transaction
      const optimisticId = vars.existingId ?? (-(Date.now() + Math.floor(Math.random() * 1000)) as TxId);
      const optimistic: TransactionWithCat = {
        id: optimisticId,
        amount: vars.amount,
        note: vars.note?.trim() || null,
        merchant: vars.merchant?.trim() || null,
        created_at: new Date().toISOString(),
        category_id: OPTIMISTIC_CATEGORY_ID,
        categories: {
          id: OPTIMISTIC_CATEGORY_ID,
          name: vars.name.trim(),
          type: vars.type,
        },
      };
      
      // Update query data optimistically
      qc.setQueryData<TransactionWithCat[]>(qk.transactions(userId), (old = []) => {
        if (vars.existingId) {
          // Update existing transaction
          return old.map((t) => 
            t.id === vars.existingId 
              ? { ...optimistic, id: vars.existingId }
              : t
          );
        }
        // Add new transaction at the beginning
        return [optimistic, ...old];
      });
      
      return { prev, optimisticId };
    },
    
    onError: (error, vars, context) => {
      // Rollback on error
      if (context?.prev) {
        qc.setQueryData(qk.transactions(userId), context.prev);
      }
      
      const action = vars.existingId ? 'update' : 'create';
      console.error(`Failed to ${action} transaction:`, error);
    },
    
    onSuccess: (data, vars) => {
      // Update the optimistic entry with real data if it was a new transaction
      if (!vars.existingId && data.categoryId !== OPTIMISTIC_CATEGORY_ID) {
        qc.setQueryData<TransactionWithCat[]>(qk.transactions(userId), (old = []) => {
          if (!old) return old;
          return old.map((t) => {
            const isOptimisticMatch = t.category_id === OPTIMISTIC_CATEGORY_ID && 
                                    t.amount === vars.amount &&
                                    t.categories?.name === vars.name.trim();
            return isOptimisticMatch 
              ? { 
                  ...t, 
                  category_id: data.categoryId, 
                  categories: t.categories ? { ...t.categories, id: data.categoryId } : t.categories
                }
              : t;
          });
        });
      }
    },
    
    onSettled: async () => {
      await invalidateRelatedQueries(qc, userId);
    },
  });
}


export function useTransactionWithFilters(userId: string, filters: Filters) {
  const normalizedFilters = normalizeFilters(filters);
  return useQuery({
    queryKey: qk.txSearch(userId, normalizedFilters),
    queryFn: () => transactionsWithFilters(userId, normalizedFilters),
    enabled: !!userId,
    staleTime: 60_000,
  })
}