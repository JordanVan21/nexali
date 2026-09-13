import type { TransactionWithCat } from "../../lib/transactions";
import type { Budget } from "../../lib/budgets";
import { monthRange, transactionTime } from "../../lib/financialPeriods";
import { sumIncomeExpense, buildMonthlyBuckets, expenseCategoryTotals } from "../../lib/financialAnalytics";
export { percentChange } from "../../lib/financialAnalytics";
import { computeBudgetProgress, type BudgetTone } from "../../lib/budgetMath";

export type CashflowPoint = { month: string; income: number; expenses: number };

export type CategorySlice = {
  id: number;
  label: string;
  amount: number;
  /** Share of this month's total expenses, 0-100. */
  percent: number;
};

export type BudgetProgress = {
  id: Budget["id"];
  category: string;
  spent: number;
  limit: number;
  /** 0-100, capped at 100 for display even if over budget. */
  percent: number;
  tone: BudgetTone;
};

export type DashboardSummary = {
  month: { income: number; expenses: number; net: number };
  prevMonth: { income: number; expenses: number };
  /** Oldest to newest, inclusive of the current month. 12 months by default so callers can slice a shorter range without recomputing. */
  cashflow: CashflowPoint[];
  /** This month's expenses only, largest first. Empty when there is no expense data this month. */
  categoryBreakdown: CategorySlice[];
  /** Most recent transactions overall (not restricted to this month). */
  recentTransactions: TransactionWithCat[];
  /** Only budgets whose month/year match the reference month. */
  budgets: BudgetProgress[];
  /** Count of current-period budgets at or above the warning threshold. */
  warningsCount: number;
};

/**
 * Derives every real, period-correct Dashboard metric from already-loaded
 * transaction and budget data, entirely client-side. This exists because
 * the backend RPCs behind the old Dashboard (`sum_income_amount`,
 * `sum_expense_amount`, `sum_category_amount`) compute all-time totals with
 * no date range, so they cannot truthfully back a "This Month" figure (see
 * docs/AUDIT_REPORT.md P1/P2). `transactions` already holds each user's
 * complete history, so real calendar-month boundaries can be applied here
 * without any backend change. Period-boundary math lives in
 * src/lib/financialPeriods.ts, multi-month/category math in
 * src/lib/financialAnalytics.ts, and budget-progress math in
 * src/lib/budgetMath.ts — all shared with Budgets and Reports so none of
 * them ever compute a period figure differently.
 */
export function computeDashboardSummary(
  transactions: TransactionWithCat[],
  budgets: Budget[],
  options: { now?: Date; cashflowMonths?: number; topCategories?: number; recentCount?: number } = {}
): DashboardSummary {
  const now = options.now ?? new Date();
  const cashflowMonths = options.cashflowMonths ?? 12;
  const topCategories = options.topCategories ?? 4;
  const recentCount = options.recentCount ?? 5;

  const currentMonth = monthRange(now.getFullYear(), now.getMonth());
  const prevMonth = monthRange(now.getFullYear(), now.getMonth() - 1);

  const monthTotals = sumIncomeExpense(transactions, currentMonth);
  const prevMonthTotals = sumIncomeExpense(transactions, prevMonth);

  const cashflow = buildMonthlyBuckets(transactions, cashflowMonths, now);

  const categoryBreakdown: CategorySlice[] = expenseCategoryTotals(transactions, currentMonth, {
    topN: topCategories,
  }).map(({ id, label, amount, percent }) => ({ id, label, amount, percent }));

  const recentTransactions = [...transactions]
    .sort((a, b) => transactionTime(b) - transactionTime(a))
    .slice(0, recentCount);

  const currentPeriodBudgets = budgets.filter(
    (b) => b.year === now.getFullYear() && b.month === now.getMonth() + 1
  );
  const budgetProgress: BudgetProgress[] = currentPeriodBudgets.map((b) => {
    const detail = computeBudgetProgress(transactions, b);
    return {
      id: detail.id,
      category: detail.category,
      spent: detail.spent,
      limit: detail.amount,
      percent: detail.displayPercent,
      tone: detail.tone,
    };
  });

  return {
    month: monthTotals,
    prevMonth: { income: prevMonthTotals.income, expenses: prevMonthTotals.expenses },
    cashflow,
    categoryBreakdown,
    recentTransactions,
    budgets: budgetProgress,
    warningsCount: budgetProgress.filter((b) => b.tone !== "success").length,
  };
}
