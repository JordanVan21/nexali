import type { TransactionWithCat } from "./transactions";
import { type MonthRange, monthRange, isTransactionInRange, isExpenseTx, sumTransactionAmounts } from "./financialPeriods";
import { expenseCategoryTotals, percentChange, type CategoryAmount } from "./financialAnalytics";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SPARKLINE_MAX_DAYS = 14;

export type BurnPeriod = {
  range: MonthRange;
  days: number;
  previousRange: MonthRange;
  previousDays: number;
  label: string;
};

/**
 * The reporting window Transactions analytics use: the user's active date
 * filter when one is set (so the summary cards below agree with the date
 * range the table itself is showing), otherwise the current calendar month
 * to date. Search, category, type and amount filters intentionally do NOT
 * narrow this window -- narrowing "Top Categories" by category, for
 * instance, would make the list degenerate. See the Part 7 report for the
 * full rationale.
 */
export function resolveBurnPeriod(fromISO?: string, toISO?: string, now: Date = new Date()): BurnPeriod {
  if (fromISO) {
    const start = new Date(fromISO);
    start.setHours(0, 0, 0, 0);
    const toDate = toISO ? new Date(toISO) : start;
    const end = new Date(toDate);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);

    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY));
    const previousEnd = start;
    const previousStart = new Date(start.getTime() - days * MS_PER_DAY);

    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const label = days === 1 ? fmt(start) : `${fmt(start)} – ${fmt(new Date(end.getTime() - MS_PER_DAY))}`;

    return {
      range: { start, end },
      days,
      previousRange: { start: previousStart, end: previousEnd },
      previousDays: days,
      label,
    };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const days = now.getDate();

  const prevMonth = monthRange(now.getFullYear(), now.getMonth() - 1);
  const previousDays = Math.round((prevMonth.end.getTime() - prevMonth.start.getTime()) / MS_PER_DAY);

  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return {
    range: { start, end },
    days,
    previousRange: prevMonth,
    previousDays,
    label: `${fmt(start)} – ${fmt(now)} (month to date)`,
  };
}

export type DailyBurn = {
  /** Total real expense amount in the period. Income is never included. */
  amount: number;
  /** amount / period.days -- the actual "burn rate" figure shown. */
  dailyRate: number;
  previousDailyRate: number | null;
  /** null when there's no truthful previous-period baseline to compare against. */
  changePercent: number | null;
};

export function computeDailyBurn(transactions: TransactionWithCat[], period: BurnPeriod): DailyBurn {
  const inRange = transactions.filter((tx) => isTransactionInRange(tx, period.range) && isExpenseTx(tx));
  const amount = sumTransactionAmounts(inRange);
  const dailyRate = period.days > 0 ? amount / period.days : 0;

  const prevInRange = transactions.filter((tx) => isTransactionInRange(tx, period.previousRange) && isExpenseTx(tx));
  const previousAmount = sumTransactionAmounts(prevInRange);
  const previousDailyRate = period.previousDays > 0 && previousAmount > 0 ? previousAmount / period.previousDays : null;

  const changePercent = previousDailyRate !== null ? percentChange(dailyRate, previousDailyRate) : null;

  return { amount, dailyRate, previousDailyRate, changePercent };
}

export function topExpenseCategories(transactions: TransactionWithCat[], period: BurnPeriod, topN = 4): CategoryAmount[] {
  return expenseCategoryTotals(transactions, period.range, { topN });
}

export type DailyBucket = { date: Date; amount: number };

/**
 * Real daily expense totals for the last up to `maxDays` days of the
 * period, oldest first -- used for the burn card's sparkline. A day with no
 * expenses is a real zero, never a fabricated value.
 */
export function dailyExpenseBuckets(
  transactions: TransactionWithCat[],
  period: BurnPeriod,
  maxDays = SPARKLINE_MAX_DAYS
): DailyBucket[] {
  const totalDays = Math.min(period.days, maxDays);
  const buckets: DailyBucket[] = [];
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    const dayStart = new Date(period.range.end.getTime() - (i + 1) * MS_PER_DAY);
    const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);
    const inDay = transactions.filter((tx) => isExpenseTx(tx) && isTransactionInRange(tx, { start: dayStart, end: dayEnd }));
    buckets.push({ date: dayStart, amount: sumTransactionAmounts(inDay) });
  }
  return buckets;
}
