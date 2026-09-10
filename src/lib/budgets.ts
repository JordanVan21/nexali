import { supabase } from "../supabaseClient";
import type { Database } from "../types/database.types";
import { getErrorMessage } from "./utils";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type BudgetRow = Database["public"]["Tables"]["budgets"]["Row"]
export type BudgetId = BudgetRow["id"];
type BudgetInsert = Database["public"]["Tables"]["budgets"]["Insert"]
type BudgetUpdate = Database["public"]["Tables"]["budgets"]["Update"]

type SumArgs = Database["public"]["Functions"]["sum_category_amount"]["Args"];

export type Budget =
  Pick<BudgetRow, "id" | "amount" | "month" | "year" | "category_id"> & {
    categories: Pick<CategoryRow, "id" | "name" | "type"> | null;
  };

export const getSpentAmount = async (userId: string, catId: number) => {
  const { data, error } = await supabase.rpc(
    "sum_category_amount",
    { uid: userId, cat_id: catId } satisfies SumArgs
  );

  if (error) {
    console.error("Error fetching spent amount:", error.message);
    return 0;
  }
  return Number(data ?? 0);
};

export const getBudgets = async (userId: string): Promise<Budget[]> => {
  try {
    const { data } = await supabase
      .from("budgets")
      .select(`
        id,
        amount,
        month,
        year,
        categories:categories!budgets_category_id_fkey ( id, name )
      `)
      .eq("user_id", userId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .throwOnError();

    return (data ?? []) as Budget[];
  } catch (e) {
    console.error("Error fetching budgets:", getErrorMessage(e));
    return [];
  }
};

export const deleteBudget = async(id: BudgetId) => {
    const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
}

export async function upsertBudget(args: {
  id?: BudgetId;
  userId: string;
  categoryId: number;
  amount: number;
  month: number;
  year: number;
}): Promise<{ id: BudgetId }> {
  const { id, userId, categoryId, amount, month, year } = args;

  if (id != null) {
    const patch = {
      category_id: categoryId,
      amount,
      month,
      year,
    } satisfies BudgetUpdate;

    await supabase.from("budgets").update(patch).eq("id", id).throwOnError();
    return { id };
  }

  const insert = {
    user_id: userId,
    category_id: categoryId,
    amount,
    month,
    year,
  } satisfies BudgetInsert;

  const { data } = await supabase
    .from("budgets")
    .insert(insert)
    .select("id")
    .single()
    .throwOnError();

  return { id: data!.id as BudgetId };
}