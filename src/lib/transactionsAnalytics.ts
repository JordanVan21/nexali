import type { TransactionsActivitySummaryResponse } from "./financialAggregates";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function fmt(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Locale-aware display label for the Transactions page's analytics period
 * ("Sep 1 – Sep 15" or "Sep 1 – Sep 15 (month to date)"), built from the
 * real server-computed range (see transactions_activity_summary(),
 * Backend Part 5). This is deliberately kept client-side and
 * locale-dependent -- it's a presentation concern (how a date reads to
 * THIS viewer), not a financial classification concern, which is why it
 * isn't part of the RPC response itself. `rangeEnd` is an exclusive
 * half-open bound, so the label uses the day before it as the real last
 * included day.
 */
export function buildActivityLabel(summary: TransactionsActivitySummaryResponse): string {
  const start = new Date(summary.rangeStart);
  const inclusiveEnd = new Date(new Date(summary.rangeEnd).getTime() - MS_PER_DAY);

  if (summary.isCustomRange) {
    return summary.days === 1 ? fmt(start) : `${fmt(start)} – ${fmt(inclusiveEnd)}`;
  }
  return `${fmt(start)} – ${fmt(inclusiveEnd)} (month to date)`;
}
