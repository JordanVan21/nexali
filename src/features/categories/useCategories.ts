import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getGlobalExpenseCategories, listCategoriesAll, upsertCategory } from "../../lib/categories";
import { qk } from "../querykeys";

export function useListCategories(
  userId: string,
  type?: "income" | "expense",
  opts?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: qk.categories(userId, type),
    queryFn: () => listCategoriesAll(userId, type),
    enabled: opts?.enabled !== false && !!userId, // Remove !!type check
    staleTime: 60_000,
  });
}

/** Global-only expense categories -- see getGlobalExpenseCategories()'s doc comment. Used by Split Expenses' receipt category picker. */
export function useListGlobalExpenseCategories() {
  return useQuery({
    queryKey: qk.globalExpenseCategories(),
    queryFn: () => getGlobalExpenseCategories(),
    staleTime: 60_000,
  });
}

type CreateCategoryVars = { name: string; type: "income" | "expense" };
type CreateCategoryRes  = { id: number };

export function useCreateCategory(userId: string) {
  const qc = useQueryClient();

  return useMutation<CreateCategoryRes, Error, CreateCategoryVars>({
    mutationFn: ({ name, type }) =>
      upsertCategory(userId, name, type),

    // A brand-new category has zero transactions yet, so it cannot appear
    // in any transaction-derived aggregate (transaction_category_counts,
    // transactions_activity_summary, dashboard_summary, reports_summary
    // all group FROM existing transactions -- see
    // invalidateCategoryDependentQueries below for the full trace of which
    // caches DO embed category names). Only the plain category list needs
    // to refresh here; invalidating the aggregate caches too would be
    // unnecessary work with no observable effect. Uses the *Root key so
    // every cached type-variant (income/expense/"all") refreshes, not just
    // the created category's own type.
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.categoriesRoot(userId) });
    },
  });
}

/**
 * Invalidates every cache whose server (or client-composed) result embeds a
 * category's `name` -- for use by any category RENAME or DELETE mutation.
 * Unlike creating a category (which cannot affect anything, since a new
 * category starts with zero transactions), renaming or deleting an
 * EXISTING category can change what every one of these already-cached
 * results would show:
 *
 *   - qk.categoriesRoot / qk.expenseCategories: the category lists
 *     themselves (CategoryPicker, CategoryFilterDropdown, BudgetFormDialog).
 *   - qk.txRoot: covers both qk.txSearch and qk.txExport, which read
 *     `category_name` directly off the `v_tx_search` view (src/lib/transactions.ts).
 *   - qk.categoryCounts: transaction_category_counts() groups and returns
 *     `category_name` directly (Backend Part 5).
 *   - qk.activitySummaryRoot: transactions_activity_summary()'s
 *     `topCategories[].label` is the category name (Backend Part 5).
 *   - qk.dashboardSummary: dashboard_summary()'s `categoryBreakdown[].label`
 *     and `recentTransactions[].categories.name` both embed it (Backend Part 4).
 *   - qk.reportsSummaryRoot: reports_summary()'s `categoryTotals[].label`,
 *     `previousCategoryTotals[].label`, and `categoryNames[]` all embed it
 *     (Backend Part 4).
 *   - qk.budgetsRoot: getBudgets() embeds `categories: { name }` via its
 *     join (src/lib/budgets.ts) -- a plain table query, but still a cached
 *     result containing the old name.
 *
 * Deliberately NOT invalidated: qk.budgetsProgressRoot (budgets_progress()
 * returns only `{category_id, spent}` -- no name, see Backend Part 4/5),
 * qk.profile, qk.avatar -- neither embeds a category name, so invalidating
 * them would be exactly the "blindly invalidate everything" this function
 * is written to avoid.
 *
 * NOTE: as of this writing, Nexali has no category RENAME or DELETE
 * mutation in the frontend (verified by grep -- only create/find-or-insert
 * exists, via upsertCategory). This function exists so that whichever
 * mutation implements rename/delete calls exactly this, rather than
 * reinventing (and likely under-scoping) the invalidation list ad hoc.
 */
export async function invalidateCategoryDependentQueries(qc: QueryClient, userId: string): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.categoriesRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.expenseCategories(userId) }),
    qc.invalidateQueries({ queryKey: qk.txRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.categoryCounts(userId) }),
    qc.invalidateQueries({ queryKey: qk.activitySummaryRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.dashboardSummary(userId) }),
    qc.invalidateQueries({ queryKey: qk.reportsSummaryRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.budgetsRoot(userId) }),
  ]);
}