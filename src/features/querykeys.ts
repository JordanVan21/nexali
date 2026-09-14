export type Filters = {
  search?: string;
  fromISO?: string;
  toISO?: string;
  categoryIds?: number[];
  categoryNames?: string[];
  types?: ("income" | "expense")[];
  minAmount?: number;
  maxAmount?: number;
  sortBy?: "date" | "amount" | "category";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

/** True when any user-facing filter (not sort/pagination) is active. */
export function hasActiveFilters(f: Filters): boolean {
  return !!(
    f.search ||
    f.fromISO ||
    f.toISO ||
    (f.categoryIds?.length ?? 0) > 0 ||
    (f.categoryNames?.length ?? 0) > 0 ||
    (f.types?.length ?? 0) > 0 ||
    f.minAmount !== undefined ||
    f.maxAmount !== undefined
  );
}

/**
 * `limit`/`offset` here are a real page size and offset -- the query they
 * drive (`transactionsWithFilters`) now requests an exact total count
 * alongside the page, so they no longer double as a hidden cap on the
 * logical result set (see docs/BACKEND_AUDIT_REPORT.md P1-1).
 */
export function normalizeFilters(f: Filters) {
  const nf = {
    ...f,
    search: f.search?.trim().toLowerCase() || undefined,
    categoryIds: f.categoryIds?.slice().sort((a, b) => a - b),
    categoryNames: f.categoryNames?.slice().sort(),
    types: f.types?.slice().sort(),
    sortBy: f.sortBy ?? "date",
    sortOrder: f.sortOrder ?? "desc",
    limit: f.limit ?? 10,
    offset: f.offset ?? 0,
  } as const;

  return Object.fromEntries(
    Object.entries(nf).filter(([, v]) => v !== undefined)
  ) as typeof nf;
}

/**
 * Same normalization as `normalizeFilters`, minus `limit`/`offset` --
 * used for the CSV export query key, which fetches every matching row
 * (see `fetchAllTransactionsWithFilters`) and must not vary by the
 * Transactions table's current page/page size.
 */
export function normalizeExportFilters(f: Filters) {
  const normalized = normalizeFilters(f);
  return Object.fromEntries(
    Object.entries(normalized).filter(([k]) => k !== "limit" && k !== "offset")
  ) as Omit<typeof normalized, "limit" | "offset">;
}

export const qk = {
  user: ["user"] as const,

  // Transactions
  txRoot: (userId: string) => ["transactions", userId] as const,
  transactions: (userId: string) => [...qk.txRoot(userId), "list"] as const,
  // (later) txByMonth: (userId, y, m) => [...qk.txRoot(userId), "byMonth", y, m] as const,

  txSearch: (userId: string, f: ReturnType<typeof normalizeFilters>) =>
    [...qk.txRoot(userId), "search", f] as const,

  txExport: (userId: string, f: ReturnType<typeof normalizeExportFilters>) =>
    [...qk.txRoot(userId), "export", f] as const,

  // Budgets
  budgetsRoot: (userId: string) => ["budgets", userId] as const,

  // Spent totals
  spentRoot: (userId: string) => ["spent", userId] as const,
  spent: (userId: string, categoryId: number) =>
    [...qk.spentRoot(userId), categoryId] as const,

  profile: (userId: string) => ["profile", userId] as const,
  totals:  (userId: string) => ["totals", userId] as const,
  expenseCategories: (userId: string) => ["expenseCategories", userId] as const,
  avatar: (userId: string) => ["avatar", userId] as const,

  categories: (userId: string, type?: "income" | "expense") => 
  ["categories", userId, type ?? "all"] as const
};