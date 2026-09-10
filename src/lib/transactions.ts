import { supabase } from "../supabaseClient";
import type { Database } from "../types/database.types";
import { useMemo } from "react";
import { type Filters } from "../features/querykeys";

type TxRow    = Database["public"]["Tables"]["transactions"]["Row"];
type TxInsert = Database["public"]["Tables"]["transactions"]["Insert"];
type TxUpdate = Database["public"]["Tables"]["transactions"]["Update"];
// type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export type TxId   = Database["public"]["Tables"]["transactions"]["Row"]["id"];

export type TransactionWithCat =
  Pick<TxRow, "id" | "amount" | "merchant" | "note" | "created_at" | "category_id"> & {
    categories: { id: number; name: string; type: "income" | "expense" } | null;
  };

export async function fetchTransactions(userId: string): Promise<TransactionWithCat[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select(`
      id,
      amount,
      merchant,
      note,
      created_at,
      category_id,
      categories:categories!transactions_category_id_fkey ( id, name, type )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<TransactionWithCat[]>(); // tell TS the shape

  if (error) throw error;
  return data ?? [];
}

export const deleteTransaction = async (id: TxId, userId: string) => {
  const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

  if (error) throw new Error(error.message);
};

export async function upsertTransaction(args : {
  existingId?: number;
  userId: string;
  categoryId: number;
  amount: number;
  merchant?: string | null;
  note?: string | null;
}): Promise<{ id: number}> {
  const { existingId, userId, categoryId, amount, merchant, note } = args;

  if (existingId != null) {
    const patch: TxUpdate = {
      category_id: categoryId,
      amount,
      merchant: merchant ?? null,
      note: note ?? null,
    };

    const { error } = await supabase
      .from("transactions")
      .update(patch)
      .eq("id", existingId)
      .eq("user_id", userId); 

    if (error) throw error;
    return { id: existingId };
  }

  const insert: TxInsert = {
    user_id: userId,
    category_id: categoryId,
    amount,
    merchant: merchant ?? null,
    note: note ?? null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(insert)
    .select("id")
    .single();

  if (error) throw error;
  return { id: data!.id as number };
}

export function useTransactionCounts(transactions: TransactionWithCat[]) {
  return useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach(transaction => {
      const categoryName = transaction.categories?.name || 'Uncategorized';
      counts[categoryName] = (counts[categoryName] || 0) + 1;
    });
    return counts;
  }, [transactions]);
}

export async function transactionsWithFilters(userId: string, filter: Filters) {
  let query = supabase
    .from("v_tx_search")
    .select("id, user_id, amount, category_id, merchant, note, created_at, category_name, category_type")
    .eq("user_id", userId)

    if (filter.fromISO) {
      query = query.gte("created_at", filter.fromISO);
    }

    if (filter.toISO) {
      query = query.lt("created_at", filter.toISO);
    }

    if (filter.categoryNames?.length) {
    query = query.in("category_name", filter.categoryNames);
  }
    if (filter.types?.length) {
      query = query.in("category_type", filter.types);
    }

    if (typeof filter.minAmount === "number") {
      query = query.gte("amount", filter.minAmount);
    }
    
    if (typeof filter.maxAmount === "number") {
      query = query.lte("amount", filter.maxAmount);
    }

    if (filter.search && filter.search.trim()) {
      const esc = (s: string) => s.replace(/,/g, "\\,");
      query = query.or(
        `merchant.ilike.%${esc(filter.search)}%,note.ilike.%${esc(filter.search)}%`
      );
    }

    const sortCol =
      filter.sortBy === "amount" ? "amount" :
      filter.sortBy === "category" ? "category_name" :
      "created_at"; // "date" default
    query = query.order(sortCol, { ascending: filter.sortOrder === "asc" });

    // Pagination (use range ONLY)
    const limit  = filter.limit  ?? 50;
    const offset = filter.offset ?? 0;           // allow 0
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    
    if (error) throw error;
    const transformedData = data?.map(row => ({
    id: row.id || `temp-${Date.now()}`,
    amount: row.amount,
    category_id: row.category_id,
    merchant: row.merchant,
    note: row.note,
    created_at: row.created_at,
    categories: {
      id: row.category_id,
      name: row.category_name,
      type: row.category_type as "income" | "expense"
    }
    })) || []; // Add fallback empty array

    return transformedData as TransactionWithCat[];
  }