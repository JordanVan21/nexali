import { percentChange } from "../../lib/financialAnalytics";
import type { StatTrend, StatTone } from "./SummaryStatCard";

export type StatTrendResult = { trend: StatTrend; tone: StatTone; label: string };

/** Direction + color for a metric where a bigger number is the good outcome (income, net, savings). */
export function trendForHigherIsBetter(
  current: number,
  previous: number,
  previousLabel = "last month"
): StatTrendResult {
  const change = percentChange(current, previous);
  if (change === null) return { trend: "flat", tone: "muted", label: `No data for ${previousLabel} yet` };
  if (Math.abs(change) < 0.5) return { trend: "flat", tone: "muted", label: `About the same as ${previousLabel}` };
  const trend: StatTrend = change > 0 ? "up" : "down";
  return {
    trend,
    tone: change > 0 ? "success" : "destructive",
    label: `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs ${previousLabel}`,
  };
}

/** Same direction math, but a bigger number (more spending) is the bad outcome. */
export function trendForLowerIsBetter(
  current: number,
  previous: number,
  previousLabel = "last month"
): StatTrendResult {
  const change = percentChange(current, previous);
  if (change === null) return { trend: "flat", tone: "muted", label: `No data for ${previousLabel} yet` };
  if (Math.abs(change) < 0.5) return { trend: "flat", tone: "muted", label: `About the same as ${previousLabel}` };
  const trend: StatTrend = change > 0 ? "up" : "down";
  return {
    trend,
    tone: change > 0 ? "destructive" : "success",
    label: `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs ${previousLabel}`,
  };
}
