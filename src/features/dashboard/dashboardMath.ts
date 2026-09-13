import type { TransactionWithCat } from "../../lib/transactions";
import type { Budget } from "../../lib/budgets";
import {
  monthRange,
  isIncomeTx,
  isExpenseTx,
  isTransactionInRange,
  sumTransactionAmounts,
  transactionTime,
} from "../../lib/financialPeriods";
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
 * without any backend change. Period-boundary math and budget-progress math
 * live in src/lib/financialPeriods.ts and src/lib/budgetMath.ts, shared
 * with the Budgets page so the two never compute spend differently.
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

  const thisMonthTx = transactions.filter((tx) => isTransactionInRange(tx, currentMonth));
  const prevMonthTx = transactions.filter((tx) => isTransactionInRange(tx, prevMonth));

  const monthIncome = sumTransactionAmounts(thisMonthTx.filter(isIncomeTx));
  const monthExpenses = sumTransactionAmounts(thisMonthTx.filter(isExpenseTx));
  const prevIncome = sumTransactionAmounts(prevMonthTx.filter(isIncomeTx));
  const prevExpenses = sumTransactionAmounts(prevMonthTx.filter(isExpenseTx));

  const cashflow: CashflowPoint[] = [];
  for (let i = cashflowMonths - 1; i >= 0; i -= 1) {
    const bucket = monthRange(now.getFullYear(), now.getMonth() - i);
    const bucketTx = transactions.filter((tx) => isTransactionInRange(tx, bucket));
    cashflow.push({
      month: bucket.start.toLocaleDateString(undefined, { month: "short" }),
      income: sumTransactionAmounts(bucketTx.filter(isIncomeTx)),
      expenses: sumTransactionAmounts(bucketTx.filter(isExpenseTx)),
    });
  }

  const expenseByCategory = new Map<number, { label: string; amount: number }>();
  for (const tx of thisMonthTx.filter(isExpenseTx)) {
    const id = tx.category_id ?? -1;
    const label = tx.categories?.name ?? "Uncategorized";
    const entry = expenseByCategory.get(id);
    if (entry) entry.amount += Number(tx.amount);
    else expenseByCategory.set(id, { label, amount: Number(tx.amount) });
  }
  const categoryTotal = monthExpenses;
  const categoryBreakdown: CategorySlice[] = Array.from(expenseByCategory.entries())
    .map(([id, { label, amount }]) => ({
      id,
      label,
      amount,
      percent: categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topCategories);

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
    month: { income: monthIncome, expenses: monthExpenses, net: monthIncome - monthExpenses },
    prevMonth: { income: prevIncome, expenses: prevExpenses },
    cashflow,
    categoryBreakdown,
    recentTransactions,
    budgets: budgetProgress,
    warningsCount: budgetProgress.filter((b) => b.tone !== "success").length,
  };
}

/** Percent change from `previous` to `current`, or null when `previous` is 0 (no truthful baseline to compare against). */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
