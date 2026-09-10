import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listCategoriesAll, upsertCategory } from "../../lib/categories";
import { qk } from "../querykeys";

export function useListCategories(
  userId: string, 
  type?: "income" | "expense", 
  opts?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: qk.categories(userId, type),
    queryFn: () => listCategoriesAll(userId, type),
    enabled: opts?.enabled !== false && !!userId, // Remove !!type check
    staleTime: 60_000,
  });
}

type CreateCategoryVars = { name: string; type: "income" | "expense" };
type CreateCategoryRes  = { id: number };

export function useCreateCategory(userId: string) {
  const qc = useQueryClient();

  return useMutation<CreateCategoryRes, Error, CreateCategoryVars>({
    mutationFn: ({ name, type }) =>
      upsertCategory(userId, name, type),

    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: qk.categories(userId, vars.type) });
    },
  });
}