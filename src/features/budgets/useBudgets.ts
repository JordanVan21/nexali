import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBudgets, deleteBudget, type BudgetId } from "../../lib/budgets";
import { qk } from "../querykeys";

export function useBudgets(userId: string) {
  return useQuery({
    queryKey: qk.budgetsRoot(userId),
    queryFn: () => getBudgets(userId),
    staleTime: 60_000,
  });
}

export function useDeleteBudget(userId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, BudgetId>({
    mutationFn: (id) => deleteBudget(id, userId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.budgetsRoot(userId) });
    },
  });
}