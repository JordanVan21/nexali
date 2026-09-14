import { supabase } from "../supabaseClient";
import type { Database } from "../types/database.types";
import { type Filters } from "../features/querykeys";

type TxRow    = Database["public"]["Tables"]["transactions"]["Row"];
type TxInsert = Database["public"]["Tables"]["transactions"]["Insert"];
type TxUpdate = Database["public"]["Tables"]["transactions"]["Update"];
// type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export type TxId   = Database["public"]["Tables"]["transactions"]["Row"]["id"];

export type TransactionWithCat =
  Pick<TxRow, "id" | "amount" | "merchant" | "note" | "created_at" | "occurred_at" | "category_id"> & {
    categories: { id: number; name: string; type: "income" | "expense" } | null;
  };

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
  /** Real financial transaction date (ISO), from the form's Date field -- never inferred. */
  occurredAt: string;
}): Promise<{ id: number}> {
  const { existingId, userId, categoryId, amount, merchant, note, occurredAt } = args;

  if (existingId != null) {
    const patch: TxUpdate = {
      category_id: categoryId,
      amount,
      merchant: merchant ?? null,
      note: note ?? null,
      // Always re-sent, whether or not the user changed it, so editing
      // amount/category never silently overwrites occurred_at with "now"
      // -- the form always loads and resubmits the real current value.
      occurred_at: occurredAt,
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
    // created_at: the technical row-creation timestamp, left to its own
    // DEFAULT now() rather than set explicitly here.
    occurred_at: occurredAt,
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(insert)
    .select("id")
    .single();

  if (error) throw error;
  return { id: data!.id as number };
}

export type TransactionsPage = {
  rows: TransactionWithCat[];
  /** Exact count of ALL rows matching the current filters, independent of the fetched page. */
  totalCount: number;
};

type VTxSearchRow = {
  id: number;
  amount: number;
  category_id: number | null;
  merchant: string | null;
  note: string | null;
  created_at: string | null;
  occurred_at: string | null;
  category_name: string | null;
  category_type: string | null;
};

const V_TX_SEARCH_COLUMNS =
  "id, user_id, amount, category_id, merchant, note, created_at, occurred_at, category_name, category_type";

/**
 * Base v_tx_search query for one user, always requesting an exact count --
 * the export path simply ignores the `count` field it doesn't need. Shared
 * so the paginated table query and the unbounded export query start from
 * literally the same builder type/shape and can never drift apart.
 */
function baseTxSearchQuery(userId: string) {
  return supabase
    .from("v_tx_search")
    .select(V_TX_SEARCH_COLUMNS, { count: "exact" })
    .eq("user_id", userId);
}

/** Applies every real Filters predicate/sort on top of `baseTxSearchQuery`. */
function applyTransactionFilters(query: ReturnType<typeof baseTxSearchQuery>, filter: Filters) {
  let q = query;

  if (filter.fromISO) {
    q = q.gte("occurred_at", filter.fromISO);
  }
  if (filter.toISO) {
    q = q.lt("occurred_at", filter.toISO);
  }
  if (filter.categoryNames?.length) {
    q = q.in("category_name", filter.categoryNames);
  }
  if (filter.types?.length) {
    q = q.in("category_type", filter.types);
  }
  if (typeof filter.minAmount === "number") {
    q = q.gte("amount", filter.minAmount);
  }
  if (typeof filter.maxAmount === "number") {
    q = q.lte("amount", filter.maxAmount);
  }
  if (filter.search && filter.search.trim()) {
    const esc = (s: string) => s.replace(/,/g, "\\,");
    q = q.or(`merchant.ilike.%${esc(filter.search)}%,note.ilike.%${esc(filter.search)}%`);
  }

  const sortCol =
    filter.sortBy === "amount" ? "amount" :
    filter.sortBy === "category" ? "category_name" :
    "occurred_at"; // "date" default -- the financial transaction date, not created_at
  // A secondary, always-unique tiebreak (id) keeps ordering fully
  // deterministic when the primary sort column has equal values (e.g. two
  // transactions with the same occurred_at or amount) -- without it, ties
  // could be returned in a different relative order between separate
  // range()/batch requests (paginated table pages, or export batches),
  // letting a row shift between pages or get duplicated/skipped.
  q = q.order(sortCol, { ascending: filter.sortOrder === "asc" }).order("id", { ascending: true });

  return q;
}

function toTransactionWithCat(row: VTxSearchRow): TransactionWithCat {
  return {
    id: row.id,
    amount: row.amount,
    category_id: row.category_id,
    merchant: row.merchant,
    note: row.note,
    created_at: row.created_at,
    occurred_at: row.occurred_at as string,
    categories: {
      id: row.category_id as number,
      name: row.category_name as string,
      type: row.category_type as "income" | "expense",
    },
  };
}

/**
 * Real server-side pagination for the Transactions page: `filter.limit` is
 * the page size and `filter.offset` is the page's starting row, and
 * `{ count: "exact" }` asks PostgREST for the true number of matching rows
 * across ALL pages -- not just the fetched one. This replaces the old
 * architecture where a hardcoded 50-row `.range()` silently capped the
 * entire logical result set and the UI then re-paginated that already-
 * truncated slice client-side (docs/BACKEND_AUDIT_REPORT.md P1-1).
 */
export async function transactionsWithFilters(userId: string, filter: Filters): Promise<TransactionsPage> {
  const query = applyTransactionFilters(baseTxSearchQuery(userId), filter);

  const pageSize = filter.limit ?? 10;
  const offset = filter.offset ?? 0;
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) throw error;

  const rows = (data ?? []).map((row) => toTransactionWithCat(row as VTxSearchRow));
  return { rows, totalCount: count ?? rows.length };
}

/**
 * Rows per export request. Kept well below the hosted PostgREST response
 * cap (see docs/BACKEND_AUDIT_REPORT.md §8, likely ~1000 but unverified for
 * the live project) so no single export request can itself be silently
 * truncated -- 500 gives real headroom under that cap either way.
 */
const EXPORT_BATCH_SIZE = 500;

/**
 * Every transaction matching the current filters, fetched in real
 * server-side batches of EXPORT_BATCH_SIZE rather than one unbounded
 * request -- a single `.select()` with no `.range()` is itself still
 * subject to the hosted PostgREST response cap, so it cannot actually
 * guarantee "all matching rows" once a user's filtered result set grows
 * past that cap. Each batch reuses the exact same filter/sort query
 * (`applyTransactionFilters`) as the Transactions table, with the same
 * deterministic id tiebreak, so batches can never overlap or skip a row
 * even when many rows share the same sort-column value. Stops once a
 * batch comes back short (fewer than EXPORT_BATCH_SIZE rows) or the known
 * exact total has been reached, whichever comes first. If any batch
 * request fails, the whole export fails -- no partial CSV is ever
 * returned as if it were complete.
 */
export async function fetchAllTransactionsWithFilters(userId: string, filter: Filters): Promise<TransactionWithCat[]> {
  const rows: TransactionWithCat[] = [];
  let offset = 0;
  let totalCount: number | null = null;

  for (;;) {
    const query = applyTransactionFilters(baseTxSearchQuery(userId), filter);
    const { data, error, count } = await query.range(offset, offset + EXPORT_BATCH_SIZE - 1);

    if (error) throw error;

    const batch = (data ?? []).map((row) => toTransactionWithCat(row as VTxSearchRow));
    rows.push(...batch);

    if (typeof count === "number") {
      totalCount = count;
    }

    const reachedKnownTotal = totalCount !== null && rows.length >= totalCount;
    const shortBatch = batch.length < EXPORT_BATCH_SIZE;
    if (reachedKnownTotal || shortBatch) break;

    offset += EXPORT_BATCH_SIZE;
  }

  return rows;
}