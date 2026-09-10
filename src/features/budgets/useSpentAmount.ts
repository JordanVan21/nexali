import { useQuery } from "@tanstack/react-query";
import { getSpentAmount } from "../../lib/budgets";
import { qk } from "../querykeys";

export function useSpentAmount(userId: string, categoryId: number | undefined) {
  return useQuery<number, Error>({
    queryKey: qk.spent(userId, categoryId ?? -1),
    queryFn: () => getSpentAmount(userId, categoryId as number),
    enabled: categoryId != null,
    staleTime: 60_000,
  });
}