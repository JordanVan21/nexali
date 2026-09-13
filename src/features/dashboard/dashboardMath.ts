import type { TransactionWithCat } from "../../lib/transactions";
import type { Budget } from "../../lib/budgets";

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
  tone: "success" | "warning" | "destructive";
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

const WARNING_THRESHOLD = 0.75;
const DESTRUCTIVE_THRESHOLD = 0.95;

function startOfMonth(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0, 1);
}

function isIncome(tx: TransactionWithCat): boolean {
  return tx.categories?.type === "income";
}

function isExpense(tx: TransactionWithCat): boolean {
  return tx.categories?.type === "expense";
}

function timeOf(tx: TransactionWithCat): number {
  return tx.created_at ? new Date(tx.created_at).getTime() : 0;
}

function inRange(tx: TransactionWithCat, start: Date, end: Date): boolean {
  const t = timeOf(tx);
  return t >= start.getTime() && t < end.getTime();
}

function sumAmount(transactions: TransactionWithCat[]): number {
  return transactions.reduce((total, tx) => total + Number(tx.amount), 0);
}

function toneFor(spent: number, limit: number): BudgetProgress["tone"] {
  if (limit <= 0) return "success";
  const ratio = spent / limit;
  if (ratio >= DESTRUCTIVE_THRESHOLD) return "destructive";
  if (ratio >= WARNING_THRESHOLD) return "warning";
  return "success";
}

/**
 * Derives every real, period-correct Dashboard metric from already-loaded
 * transaction and budget data, entirely client-side. This exists because
 * the backend RPCs behind the old Dashboard (`sum_income_amount`,
 * `sum_expense_amount`, `sum_category_amount`) compute all-time totals with
 * no date range, so they cannot truthfully back a "This Month" figure (see
 * docs/AUDIT_REPORT.md P1/P2). `transactions` already holds each user's
 * complete history, so real calendar-month boundaries can be applied here
 * without any backend change.
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

  const currentMonthStart = startOfMonth(now.getFullYear(), now.getMonth());
  const nextMonthStart = startOfMonth(now.getFullYear(), now.getMonth() + 1);
  const prevMonthStart = startOfMonth(now.getFullYear(), now.getMonth() - 1);

  const thisMonthTx = transactions.filter((tx) => inRange(tx, currentMonthStart, nextMonthStart));
  const prevMonthTx = transactions.filter((tx) => inRange(tx, prevMonthStart, currentMonthStart));

  const monthIncome = sumAmount(thisMonthTx.filter(isIncome));
  const monthExpenses = sumAmount(thisMonthTx.filter(isExpense));
  const prevIncome = sumAmount(prevMonthTx.filter(isIncome));
  const prevExpenses = sumAmount(prevMonthTx.filter(isExpense));

  const cashflow: CashflowPoint[] = [];
  for (let i = cashflowMonths - 1; i >= 0; i -= 1) {
    const bucketStart = startOfMonth(now.getFullYear(), now.getMonth() - i);
    const bucketEnd = startOfMonth(now.getFullYear(), now.getMonth() - i + 1);
    const bucketTx = transactions.filter((tx) => inRange(tx, bucketStart, bucketEnd));
    cashflow.push({
      month: bucketStart.toLocaleDateString(undefined, { month: "short" }),
      income: sumAmount(bucketTx.filter(isIncome)),
      expenses: sumAmount(bucketTx.filter(isExpense)),
    });
  }

  const expenseByCategory = new Map<number, { label: string; amount: number }>();
  for (const tx of thisMonthTx.filter(isExpense)) {
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
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, recentCount);

  const currentPeriodBudgets = budgets.filter(
    (b) => b.year === now.getFullYear() && b.month === now.getMonth() + 1
  );
  const budgetProgress: BudgetProgress[] = currentPeriodBudgets.map((b) => {
    const spent = sumAmount(
      thisMonthTx.filter((tx) => (tx.category_id ?? null) === b.category_id)
    );
    const limit = Number(b.amount);
    return {
      id: b.id,
      category: b.categories?.name ?? "Uncategorized",
      spent,
      limit,
      percent: limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0,
      tone: toneFor(spent, limit),
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
