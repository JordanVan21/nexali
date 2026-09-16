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

  txSearch: (userId: string, f: ReturnType<typeof normalizeFilters>) =>
    [...qk.txRoot(userId), "search", f] as const,

  txExport: (userId: string, f: ReturnType<typeof normalizeExportFilters>) =>
    [...qk.txRoot(userId), "export", f] as const,

  // Budgets
  budgetsRoot: (userId: string) => ["budgets", userId] as const,

  // Server-side financial aggregates (Backend Part 4). `userId` here is
  // only a per-session cache namespace -- the RPCs themselves derive the
  // real authorized user from auth.uid() on the server and accept no user
  // id argument, so this never doubles as an authorization mechanism.
  // The *Root variants exist so a transaction mutation can invalidate
  // every cached variant (every monthsCount/categoryName, every
  // year/month) in one call -- TanStack Query treats a shorter queryKey as
  // a prefix match against every longer key that starts with it.
  dashboardSummary: (userId: string) => ["dashboardSummary", userId] as const,
  reportsSummaryRoot: (userId: string) => ["reportsSummary", userId] as const,
  reportsSummary: (userId: string, monthsCount: number, categoryName: string) =>
    [...qk.reportsSummaryRoot(userId), monthsCount, categoryName] as const,
  budgetsProgressRoot: (userId: string) => ["budgetsProgress", userId] as const,
  budgetsProgress: (userId: string, year: number, month: number) =>
    [...qk.budgetsProgressRoot(userId), year, month] as const,

  // Backend Part 5: Transactions page's category-count badges and
  // Average-Daily-Burn/Top-Categories analytics. categoryCounts has no
  // variant (all-time, filter-independent -- see
  // transaction_category_counts()'s docs), so its root IS its full key.
  // activitySummary varies by the active date-range filter (or its
  // absence, for the default month-to-date period).
  categoryCounts: (userId: string) => ["categoryCounts", userId] as const,
  activitySummaryRoot: (userId: string) => ["activitySummary", userId] as const,
  activitySummary: (userId: string, fromISO?: string, toISO?: string) =>
    [...qk.activitySummaryRoot(userId), fromISO ?? null, toISO ?? null] as const,

  profile: (userId: string) => ["profile", userId] as const,

  // Backend Part 7. notificationsRoot lets a mark-read/mark-all/dismiss
  // mutation invalidate every cached filter tab in one call, the same
  // *Root prefix-invalidation pattern used everywhere else in this file.
  notificationsRoot: (userId: string) => ["notifications", userId] as const,
  notifications: (userId: string, filter: string) => [...qk.notificationsRoot(userId), filter] as const,
  notificationsUnreadCount: (userId: string) => ["notificationsUnreadCount", userId] as const,
  notificationPreferences: (userId: string) => ["notificationPreferences", userId] as const,

  // Backend Part 8 (Friends). friendsSearchRoot lets a send-request
  // mutation invalidate every cached search query string in one call (the
  // same *Root prefix-invalidation pattern used everywhere else in this
  // file) without touching friendsList/friendsIncoming/friendsIncomingCount,
  // which a send doesn't affect. `userId` on every key is only a
  // per-session cache namespace -- every Friends RPC derives the real
  // caller from auth.uid() server-side and accepts no user id argument.
  friendsRoot: (userId: string) => ["friends", userId] as const,
  friendsList: (userId: string) => [...qk.friendsRoot(userId), "list"] as const,
  friendsIncoming: (userId: string) => [...qk.friendsRoot(userId), "incoming"] as const,
  friendsIncomingCount: (userId: string) => [...qk.friendsRoot(userId), "incomingCount"] as const,
  friendsSearchRoot: (userId: string) => [...qk.friendsRoot(userId), "search"] as const,
  friendsSearch: (userId: string, query: string) => [...qk.friendsSearchRoot(userId), query] as const,
  expenseCategories: (userId: string) => ["expenseCategories", userId] as const,
  avatar: (userId: string) => ["avatar", userId] as const,

  // categoriesRoot lets a category mutation invalidate every cached
  // type-variant (income/expense/"all") in one call, the same *Root
  // prefix-invalidation pattern used everywhere else in this file --
  // previously a category mutation only invalidated its OWN type's cached
  // list, silently leaving the "all types" list (and the other type's
  // list) stale.
  categoriesRoot: (userId: string) => ["categories", userId] as const,
  categories: (userId: string, type?: "income" | "expense") =>
    [...qk.categoriesRoot(userId), type ?? "all"] as const,
};