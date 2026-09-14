import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCreateCategory, invalidateCategoryDependentQueries } from "./useCategories";
import { qk } from "../querykeys";

vi.mock("../../lib/categories", () => ({
  upsertCategory: vi.fn().mockResolvedValue({ id: 1, name: "Dining", type: "expense" }),
}));

const USER_ID = "u1";

/**
 * Regression coverage for the cache-staleness correction to Backend Part 5:
 * a category rename/delete can change a NAME that is already embedded in
 * several cached aggregate results (transaction_category_counts,
 * transactions_activity_summary, dashboard_summary, reports_summary,
 * getBudgets' joined category name, v_tx_search's category_name column).
 * The server reading the new name on its next query does not matter until
 * TanStack Query actually refetches -- these tests verify real
 * invalidation/refetch-eligibility on a real QueryClient, not merely that
 * an RPC would eventually return a fresh name.
 */

/** Seeds `key` with arbitrary cached data so its invalidation state is observable. */
function seed(qc: QueryClient, key: readonly unknown[]) {
  qc.setQueryData(key as unknown[], { seeded: true });
}

function isInvalidated(qc: QueryClient, key: readonly unknown[]): boolean {
  return qc.getQueryState(key as unknown[])?.isInvalidated === true;
}

describe("invalidateCategoryDependentQueries", () => {
  it("invalidates transaction_category_counts' cache (qk.categoryCounts)", async () => {
    const qc = new QueryClient();
    seed(qc, qk.categoryCounts(USER_ID));

    await invalidateCategoryDependentQueries(qc, USER_ID);

    expect(isInvalidated(qc, qk.categoryCounts(USER_ID))).toBe(true);
  });

  it("invalidates every cached variant of the Transactions-page activity summary (qk.activitySummaryRoot)", async () => {
    const qc = new QueryClient();
    seed(qc, qk.activitySummary(USER_ID)); // default (no date filter) variant
    seed(qc, qk.activitySummary(USER_ID, "2024-03-01T00:00:00.000Z", "2024-03-08T00:00:00.000Z")); // a custom-range variant

    await invalidateCategoryDependentQueries(qc, USER_ID);

    expect(isInvalidated(qc, qk.activitySummary(USER_ID))).toBe(true);
    expect(isInvalidated(qc, qk.activitySummary(USER_ID, "2024-03-01T00:00:00.000Z", "2024-03-08T00:00:00.000Z"))).toBe(true);
  });

  it("invalidates the Dashboard summary (qk.dashboardSummary) -- it embeds category names in categoryBreakdown and recentTransactions", async () => {
    const qc = new QueryClient();
    seed(qc, qk.dashboardSummary(USER_ID));

    await invalidateCategoryDependentQueries(qc, USER_ID);

    expect(isInvalidated(qc, qk.dashboardSummary(USER_ID))).toBe(true);
  });

  it("invalidates every cached variant of the Reports summary (qk.reportsSummaryRoot) -- it embeds category names in categoryTotals/categoryNames", async () => {
    const qc = new QueryClient();
    seed(qc, qk.reportsSummary(USER_ID, 6, "All Categories"));
    seed(qc, qk.reportsSummary(USER_ID, 1, "Dining"));

    await invalidateCategoryDependentQueries(qc, USER_ID);

    expect(isInvalidated(qc, qk.reportsSummary(USER_ID, 6, "All Categories"))).toBe(true);
    expect(isInvalidated(qc, qk.reportsSummary(USER_ID, 1, "Dining"))).toBe(true);
  });

  it("invalidates the category lists and budgets list, which also embed category names", async () => {
    const qc = new QueryClient();
    seed(qc, qk.categories(USER_ID));
    seed(qc, qk.categories(USER_ID, "expense"));
    seed(qc, qk.expenseCategories(USER_ID));
    seed(qc, qk.budgetsRoot(USER_ID));
    seed(qc, qk.txSearch(USER_ID, { sortBy: "date", sortOrder: "desc", limit: 10, offset: 0 } as never));

    await invalidateCategoryDependentQueries(qc, USER_ID);

    expect(isInvalidated(qc, qk.categories(USER_ID))).toBe(true);
    expect(isInvalidated(qc, qk.categories(USER_ID, "expense"))).toBe(true);
    expect(isInvalidated(qc, qk.expenseCategories(USER_ID))).toBe(true);
    expect(isInvalidated(qc, qk.budgetsRoot(USER_ID))).toBe(true);
    expect(isInvalidated(qc, qk.txSearch(USER_ID, { sortBy: "date", sortOrder: "desc", limit: 10, offset: 0 } as never))).toBe(true);
  });

  it("does NOT invalidate budgets_progress's cache -- it returns only {category_id, spent}, never a name", async () => {
    const qc = new QueryClient();
    seed(qc, qk.budgetsProgress(USER_ID, 2024, 3));

    await invalidateCategoryDependentQueries(qc, USER_ID);

    expect(isInvalidated(qc, qk.budgetsProgress(USER_ID, 2024, 3))).toBe(false);
  });

  it("does NOT invalidate unrelated caches (profile, avatar) -- proving this is not a blanket invalidate-everything", async () => {
    const qc = new QueryClient();
    seed(qc, qk.profile(USER_ID));
    seed(qc, qk.avatar(USER_ID));

    await invalidateCategoryDependentQueries(qc, USER_ID);

    expect(isInvalidated(qc, qk.profile(USER_ID))).toBe(false);
    expect(isInvalidated(qc, qk.avatar(USER_ID))).toBe(false);
  });
});

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useCreateCategory", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates every cached type-variant of the category list (qk.categoriesRoot), not just the created category's own type", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    seed(qc, qk.categories(USER_ID, "income"));
    seed(qc, qk.categories(USER_ID, "expense"));
    seed(qc, qk.categories(USER_ID));

    const { result } = renderHook(() => useCreateCategory(USER_ID), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({ name: "Dining", type: "expense" });

    await waitFor(() => {
      expect(isInvalidated(qc, qk.categories(USER_ID, "income"))).toBe(true);
      expect(isInvalidated(qc, qk.categories(USER_ID, "expense"))).toBe(true);
      expect(isInvalidated(qc, qk.categories(USER_ID))).toBe(true);
    });
  });

  it("does NOT invalidate any transaction-derived aggregate cache -- a brand-new category has zero transactions and cannot appear in any of them yet", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    seed(qc, qk.categoryCounts(USER_ID));
    seed(qc, qk.dashboardSummary(USER_ID));
    seed(qc, qk.reportsSummary(USER_ID, 6, "All Categories"));
    seed(qc, qk.activitySummary(USER_ID));

    const { result } = renderHook(() => useCreateCategory(USER_ID), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({ name: "Dining", type: "expense" });

    // Give any (incorrect) async invalidation a chance to land before asserting it didn't.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(isInvalidated(qc, qk.categoryCounts(USER_ID))).toBe(false);
    expect(isInvalidated(qc, qk.dashboardSummary(USER_ID))).toBe(false);
    expect(isInvalidated(qc, qk.reportsSummary(USER_ID, 6, "All Categories"))).toBe(false);
    expect(isInvalidated(qc, qk.activitySummary(USER_ID))).toBe(false);
  });
});
