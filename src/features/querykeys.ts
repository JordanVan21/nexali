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

export function normalizeFilters(f: Filters) {
  const nf = {
    ...f,
    search: f.search?.trim().toLowerCase() || undefined,
    categoryIds: f.categoryIds?.slice().sort((a, b) => a - b),
    categoryNames: f.categoryNames?.slice().sort(),
    types: f.types?.slice().sort(),
    sortBy: f.sortBy ?? "date",
    sortOrder: f.sortOrder ?? "desc",
    limit: f.limit ?? 50,
    offset: f.offset ?? 0,
  } as const;

  return Object.fromEntries(
    Object.entries(nf).filter(([, v]) => v !== undefined)
  ) as typeof nf;
}

export const qk = {
  user: ["user"] as const,

  // Transactions
  txRoot: (userId: string) => ["transactions", userId] as const,
  transactions: (userId: string) => [...qk.txRoot(userId), "list"] as const,
  // (later) txByMonth: (userId, y, m) => [...qk.txRoot(userId), "byMonth", y, m] as const,

  txSearch: (userId: string, f: ReturnType<typeof normalizeFilters>) =>
    [...qk.txRoot(userId), "search", f] as const,

  // Budgets
  budgetsRoot: (userId: string) => ["budgets", userId] as const,
  budgets: (userId: string, year: number, month: number) =>
    [...qk.budgetsRoot(userId), year, month] as const,

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