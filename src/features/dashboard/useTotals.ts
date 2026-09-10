import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../supabaseClient";
import { qk } from "../querykeys";

async function fetchTotals(userId: string) {
  const [{ data: inc, error: incErr }, { data: exp, error: expErr }] =
    await Promise.all([
      supabase.rpc("sum_income_amount", { uid: userId }),
      supabase.rpc("sum_expense_amount", { uid: userId }),
    ]);
  if (incErr) throw incErr;
  if (expErr) throw expErr;
  return { income: Number(inc ?? 0), spent: Number(exp ?? 0) };
}

export function useTotals(userId: string) {
  return useQuery<{ income: number; spent: number }, Error>({
    queryKey: qk.totals(userId),
    queryFn: () => fetchTotals(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: "always",
  });
}