import { getExpenseCategories } from "../../lib/categories";
import { upsertBudget } from "../../lib/budgets";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "../querykeys";
import type { Database } from "../../types/database.types";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategoryOption = Pick<CategoryRow, "id" | "name">;

export type SaveBudgetVars = {
  id?: number;
  userId: string;
  categoryId: number;
  amount: number;
  month: number;
  year: number;
};

export type SaveBudgetResult = { id: number };

export function useExpenseCategories(userId?: string) {
  return useQuery<CategoryOption[]>({
    queryKey: userId ? qk.expenseCategories(userId) : ["expenseCategories", "disabled"] as const,
    queryFn: () => getExpenseCategories(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000

  })
}

export function useSaveBudget() {
  const qc = useQueryClient();
  return useMutation<SaveBudgetResult, Error, SaveBudgetVars>({
    mutationFn: (vars) => upsertBudget(vars),
    onSuccess: async (_res, vars) => {
      await Promise.all([
        qc.invalidateQueries({
        queryKey: qk.budgets(vars.userId, vars.year, vars.month),
        })
      ]);
    }
  });
}