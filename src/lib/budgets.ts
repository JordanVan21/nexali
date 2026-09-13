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

/**
 * All-time spend for a category — `sum_category_amount` accepts no date
 * range (docs/AUDIT_REPORT.md P2). Do not use this for a period-scoped
 * ("this month") figure; use `computeBudgetSpend`/`computeBudgetProgress`
 * from `src/lib/budgetMath.ts` against already-loaded transactions instead.
 */
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

export const deleteBudget = async (id: BudgetId, userId: string) => {
    const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

    if (error) throw new Error(error.message);
}

/** The DB-enforced unique constraint on (user_id, category_id, month, year). */
const DUPLICATE_BUDGET_CONSTRAINT = "budgets_user_id_category_id_month_year_key";

/** True when `error` is the unique-constraint violation for an existing budget in that category/month/year. */
export function isDuplicateBudgetError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return e.code === "23505" || (e.message?.includes(DUPLICATE_BUDGET_CONSTRAINT) ?? false);
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