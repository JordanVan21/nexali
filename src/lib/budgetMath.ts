import type { Budget, BudgetId } from "./budgets";

/**
 * Shared budget-progress math, used by both the Dashboard's budget
 * snapshot and the Budgets page, so the two never drift into
 * slightly-different spend/threshold logic. Thresholds match the
 * convention already established by the pre-redesign BudgetCard's
 * `getColor()` (75% / 95%) and carried into Part 3's dashboardMath.ts.
 *
 * As of Backend Part 4, the real per-category `spent` figure is computed
 * server-side (supabase/migrations/20260915000000_financial_aggregate_functions.sql's
 * budgets_progress()), timezone-aware and without depending on an
 * unbounded client-side transaction fetch -- see deriveBudgetProgress
 * below. This module keeps ownership of the tone/status/percent
 * interpretation logic (a pure function of already-known numbers), so
 * those thresholds live in exactly one place regardless of where the
 * underlying `spent` figure came from.
 */
export const BUDGET_WARNING_THRESHOLD = 0.75;
export const BUDGET_CRITICAL_THRESHOLD = 0.95;

/** Coarse 3-way tone, used where a simple color/icon mapping is enough (Dashboard). */
export type BudgetTone = "success" | "warning" | "destructive";

/** Finer 4-way status, used where "over budget" needs to read differently from "near the limit" (Budgets page). */
export type BudgetStatus = "normal" | "warning" | "critical" | "over";

export function budgetToneFor(spent: number, limit: number): BudgetTone {
  if (limit <= 0) return "success";
  const ratio = spent / limit;
  if (ratio >= BUDGET_CRITICAL_THRESHOLD) return "destructive";
  if (ratio >= BUDGET_WARNING_THRESHOLD) return "warning";
  return "success";
}

export function budgetStatusFor(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return "normal";
  const ratio = spent / limit;
  if (ratio > 1) return "over";
  if (ratio >= BUDGET_CRITICAL_THRESHOLD) return "critical";
  if (ratio >= BUDGET_WARNING_THRESHOLD) return "warning";
  return "normal";
}

export type BudgetProgressDetail = {
  id: BudgetId;
  category: string;
  categoryId: number | null;
  month: number;
  year: number;
  /** The budget's limit. */
  amount: number;
  spent: number;
  /** amount - spent. Never clamped — can be negative when over budget. */
  remaining: number;
  /** 0-100, clamped, safe to use directly as a progress-bar width. */
  displayPercent: number;
  /** Unclamped — can exceed 100 when over budget. */
  actualPercent: number;
  isOverBudget: boolean;
  /** max(0, spent - amount). */
  overAmount: number;
  tone: BudgetTone;
  status: BudgetStatus;
};

/**
 * Full real progress detail for one budget, from a `spent` figure already
 * computed server-side (budgets_progress()) for that budget's own
 * category/month/year -- see src/features/budgets/useBudgetsForPeriod.ts
 * and src/features/dashboard/useDashboardData.ts for how `spent` is looked
 * up from the grouped per-category RPC result. Defaults to 0 when the RPC
 * returned no row for this category (no expense spend in the period at
 * all), matching SQL's own `COALESCE(SUM(...), 0)` semantics.
 */
export function deriveBudgetProgress(budget: Budget, spent: number): BudgetProgressDetail {
  const amount = Number(budget.amount);
  const actualPercent = amount > 0 ? (spent / amount) * 100 : 0;

  return {
    id: budget.id,
    category: budget.categories?.name ?? "Uncategorized",
    categoryId: budget.category_id,
    month: budget.month,
    year: budget.year,
    amount,
    spent,
    remaining: amount - spent,
    displayPercent: Math.min(100, Math.max(0, Math.round(actualPercent))),
    actualPercent,
    isOverBudget: spent > amount,
    overAmount: Math.max(0, spent - amount),
    tone: budgetToneFor(spent, amount),
    status: budgetStatusFor(spent, amount),
  };
}
