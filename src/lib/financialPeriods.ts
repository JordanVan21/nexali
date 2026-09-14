import type { TransactionWithCat } from "./transactions";

/**
 * Calendar-month boundary and transaction-filtering helpers shared by every
 * feature that needs a truthful "this period" figure (Dashboard, Budgets).
 * These exist because the backend RPCs (`sum_income_amount`,
 * `sum_expense_amount`, `sum_category_amount`) compute all-time totals with
 * no date range (see docs/AUDIT_REPORT.md P1/P2) — real calendar-month math
 * has to happen client-side, against already-loaded transaction data,
 * instead.
 */

export type MonthRange = { start: Date; end: Date };

/** `monthIndex0` is 0-based (January = 0), matching `Date`'s own convention. */
export function startOfMonth(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0, 1);
}

/** Start inclusive, end exclusive. `monthIndex0` is 0-based. */
export function monthRange(year: number, monthIndex0: number): MonthRange {
  return { start: startOfMonth(year, monthIndex0), end: startOfMonth(year, monthIndex0 + 1) };
}

/** The real financial transaction date/time (occurred_at), not the technical created_at row-insertion timestamp. */
export function transactionTime(tx: TransactionWithCat): number {
  return tx.occurred_at ? new Date(tx.occurred_at).getTime() : 0;
}

export function isTransactionInRange(tx: TransactionWithCat, range: MonthRange): boolean {
  const t = transactionTime(tx);
  return t >= range.start.getTime() && t < range.end.getTime();
}

export function isIncomeTx(tx: TransactionWithCat): boolean {
  return tx.categories?.type === "income";
}

export function isExpenseTx(tx: TransactionWithCat): boolean {
  return tx.categories?.type === "expense";
}

export function sumTransactionAmounts(transactions: TransactionWithCat[]): number {
  return transactions.reduce((total, tx) => total + Number(tx.amount), 0);
}
