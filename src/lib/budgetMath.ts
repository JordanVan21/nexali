import type { TransactionWithCat } from "./transactions";
import type { Budget, BudgetId } from "./budgets";
import { monthRange, isExpenseTx, isTransactionInRange, sumTransactionAmounts } from "./financialPeriods";

/**
 * Shared budget-progress math, used by both the Dashboard's budget
 * snapshot and the Budgets page, so the two never drift into
 * slightly-different spend/threshold logic. Thresholds match the
 * convention already established by the pre-redesign BudgetCard's
 * `getColor()` (75% / 95%) and carried into Part 3's dashboardMath.ts.
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

/**
 * Real spend for one budget: expense transactions in that budget's own
 * category, falling inside that budget's own month/year — never the
 * all-time `sum_category_amount` RPC (see docs/AUDIT_REPORT.md P2).
 */
export function computeBudgetSpend(
  transactions: TransactionWithCat[],
  budget: Pick<Budget, "category_id" | "month" | "year">
): number {
  const range = monthRange(budget.year, budget.month - 1);
  return sumTransactionAmounts(
    transactions.filter(
      (tx) =>
        isExpenseTx(tx) &&
        (tx.category_id ?? null) === budget.category_id &&
        isTransactionInRange(tx, range)
    )
  );
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

/** Full real progress detail for one budget, derived from already-loaded transactions. */
export function computeBudgetProgress(transactions: TransactionWithCat[], budget: Budget): BudgetProgressDetail {
  const spent = computeBudgetSpend(transactions, budget);
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
