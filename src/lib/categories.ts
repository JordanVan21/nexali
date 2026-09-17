import { supabase } from "../supabaseClient";
import type { Database } from "../types/database.types";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

const toTitle = (s: string) =>
  s.trim().replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

export async function resolveCategoryId(args: {
  name: string; type: "income" | "expense"; userId: string;
}): Promise<number> {
  const { id } = await upsertCategory(args.userId, args.name, args.type);
  return id as number;
}

export async function getExpenseCategories(userId: string): Promise<
  Array<Pick<CategoryRow, "id" | "name">>
> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("type", "expense")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Array<Pick<CategoryRow, "id" | "name">>;
}

/**
 * GLOBAL (user_id IS NULL) expense categories only -- no per-user
 * filtering, since a global category is by definition visible to every
 * Nexali account. Used exclusively by Split Expenses: submit_split_expense()
 * rejects any user-owned category (a category private to one participant
 * cannot safely represent every other participant's own generated
 * transaction -- see docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry),
 * so the Split receipt category picker only ever offers categories the
 * backend will actually accept.
 */
export async function getGlobalExpenseCategories(): Promise<Array<Pick<CategoryRow, "id" | "name">>> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("type", "expense")
    .is("user_id", null)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Array<Pick<CategoryRow, "id" | "name">>;
}

export async function listCategoriesAll(
  userId: string,
  type?: "income" | "expense"
): Promise<Array<Pick<CategoryRow, "id" | "name" | "type">>> {
  let query = supabase
    .from("categories")
    .select("id,name,type,user_id")

    if (type) {
      query = query.eq("type", type);
    }

  const { data, error } = await query
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("name");
  if (error) throw error;

  const byName = new Map<string, { id: number; name: string; type: string; user_id: string | null }>();
  
  for (const c of data ?? []) {
    const k = (c.name ?? "").trim().toLowerCase();
    const existing = byName.get(k);

    if (!existing) {
      byName.set(k, c);
      continue;
    }
    if (existing.user_id !== null && c.user_id === null) {
      byName.set(k, c);
    }
  }

  return Array.from(byName.values()).map(({ id, name, type }) => ({ id, name, type }));
}

export async function upsertCategory(
  userId: string,
  name: string,
  type: "income" | "expense"
) {
  // ALWAYS normalize to title case - this is our "one case ruling"
  const normalizedName = toTitle(name);

  // user-specific first - use exact matching now
  const { data: u, error: ue } = await supabase
    .from("categories")
    .select("id, name, type")
    .eq("type", type)
    .eq("user_id", userId)
    .eq("name", normalizedName)  // Changed from ilike to eq
    .maybeSingle();
  if (ue) throw ue;
  if (u) return u;

  // global fallback - use exact matching
  const { data: g, error: ge } = await supabase
    .from("categories")
    .select("id, name, type")
    .eq("type", type)
    .is("user_id", null)
    .eq("name", normalizedName)  // Changed from ilike to eq
    .maybeSingle();
  if (ge) throw ge;
  if (g) return g;

  // create user-specific with normalized name
  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: userId, name: normalizedName, type })
    .select("id, name, type")
    .single();
  if (error) throw error;
  return data!;
}