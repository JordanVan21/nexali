import type { Budget } from "../../lib/budgets";
import type { TransactionWithCat } from "../../lib/transactions";
import type { DashboardSummaryResponse, BudgetsProgressRow } from "../../lib/financialAggregates";
import { deriveBudgetProgress, type BudgetTone } from "../../lib/budgetMath";
export { percentChange } from "../../lib/financialAnalytics";

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
  /** Oldest to newest, inclusive of the current month. */
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

/** `month`/`year` -> a short locale-aware month label (e.g. "Jun"), matching the label format Nexali has always used for the cashflow chart. */
function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

/**
 * Combines the server-computed transaction summary (dashboard_summary(),
 * timezone-aware and bounded -- see docs/BACKEND_AUDIT_REPORT.md Backend
 * Part 4) with the server-computed budget spend for the SAME period
 * (budgets_progress(), reused from the Budgets page) into the exact
 * DashboardSummary shape the UI has always rendered. `periodBudgets` is
 * the caller's already-loaded budget list (useBudgets), pre-filtered to
 * `raw.currentYear`/`raw.currentMonth` -- see useDashboardData.ts.
 */
export function mapDashboardSummary(
  raw: DashboardSummaryResponse,
  periodBudgets: Budget[],
  spendRows: BudgetsProgressRow[]
): DashboardSummary {
  const spendByCategory = new Map<number, number>();
  for (const row of spendRows) spendByCategory.set(row.categoryId, row.spent);

  const budgetProgress: BudgetProgress[] = periodBudgets.map((b) => {
    const detail = deriveBudgetProgress(b, spendByCategory.get(b.category_id ?? -1) ?? 0);
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
    month: raw.month,
    prevMonth: raw.prevMonth,
    cashflow: raw.cashflow.map((b) => ({ month: monthLabel(b.year, b.month), income: b.income, expenses: b.expenses })),
    categoryBreakdown: raw.categoryBreakdown,
    recentTransactions: raw.recentTransactions,
    budgets: budgetProgress,
    warningsCount: budgetProgress.filter((b) => b.tone !== "success").length,
  };
}
