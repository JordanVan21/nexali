import { Link } from "react-router-dom";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useUserInfo } from "../shared/useUserId";
import { useTransactionsActivitySummary } from "../features/transactions/useTransactionsActivitySummary";
import { useFormatCurrency } from "../features/profiles/useFormatPreferences";
import { getErrorMessage, cn } from "../lib/utils";
import { Skeleton } from "./states/Skeleton";
import { ErrorState } from "./states/ErrorState";
import { buildActivityLabel } from "../lib/transactionsAnalytics";
import type { Filters } from "../features/querykeys";

const CATEGORY_TONES = [
  { text: "text-primary", bar: "bg-primary" },
  { text: "text-success", bar: "bg-success" },
  { text: "text-warning", bar: "bg-warning" },
];

function AnalyticsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6" aria-hidden="true">
      <div className="nexali-panel space-y-4 rounded-xl p-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="nexali-panel space-y-4 rounded-xl p-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

/**
 * Deterministic, real-data summary section below the Transactions table:
 * Average Daily Burn and Top Categories. Both are computed server-side
 * (transactions_activity_summary() -- Backend Part 5), timezone-aware via
 * the caller's configured profiles.timezone, scoped to the Transactions
 * page's active date filter (`filters.fromISO`/`toISO`) or the current
 * month to date when neither is set. No AI, no fabricated trend, no mock
 * category labels.
 */
export function TransactionAnalytics({ filters }: { filters: Filters }) {
  const { userId } = useUserInfo();
  const formatCurrency = useFormatCurrency();
  const query = useTransactionsActivitySummary(userId, filters.fromISO, filters.toISO);

  if (query.isLoading) return <AnalyticsSkeleton />;

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Couldn't load your activity summary"
        message={getErrorMessage(query.error, "Please try again.")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const summary = query.data;
  const label = buildActivityLabel(summary);
  const categories = summary.topCategories;
  const buckets = summary.dailyBuckets;
  const maxBucket = Math.max(0, ...buckets.map((b) => b.amount));
  const up = summary.changePercent !== null && summary.changePercent > 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Based on real expense transactions for {label}. Independent of the search, category, type, and amount
        filters above.
      </p>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <section className="nexali-panel group rounded-xl p-5 xl:p-6" aria-labelledby="daily-burn-heading">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="daily-burn-heading" className="text-xs font-medium uppercase tracking-wider text-muted-foreground xl:text-sm">
                Average Daily Burn
              </h2>
              <p className="font-display mt-1 flex flex-wrap items-baseline gap-2 text-[28px] font-bold leading-tight text-foreground xl:text-[34px]">
                {formatCurrency(summary.dailyRate)}
                <span
                  className={cn(
                    "text-sm font-medium",
                    summary.changePercent === null ? "text-muted-foreground" : up ? "text-destructive" : "text-success"
                  )}
                >
                  {summary.changePercent === null
                    ? "No previous-period data"
                    : `${up ? "+" : "−"}${Math.abs(Math.round(summary.changePercent))}% vs previous period`}
                </span>
              </p>
            </div>
            <span
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full",
                up ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
              )}
              aria-hidden="true"
            >
              {up ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </span>
          </div>
          <div className="mt-5 flex h-16 items-end gap-1" aria-hidden="true">
            {buckets.map((b, i) => (
              <div
                key={i}
                style={{ height: `${maxBucket > 0 ? Math.max(4, (b.amount / maxBucket) * 100) : 4}%` }}
                className={cn(
                  "flex-1 rounded-t-sm transition-colors",
                  maxBucket > 0 && b.amount === maxBucket ? "bg-primary/70" : "bg-accent/30 group-hover:bg-primary/30"
                )}
              />
            ))}
          </div>
        </section>

        <section className="nexali-panel rounded-xl p-5 xl:p-6" aria-labelledby="top-categories-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="top-categories-heading" className="text-xs font-medium uppercase tracking-wider text-muted-foreground xl:text-sm">
              Top Categories
            </h2>
            <Link to="/reports" className="text-sm font-medium text-primary hover:underline">
              View All
            </Link>
          </div>
          {categories.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No expenses in this period.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {categories.map((c, i) => {
                const tone = CATEGORY_TONES[i % CATEGORY_TONES.length];
                const percent = Math.round(c.percent);
                return (
                  <li key={c.id}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-foreground">{c.label}</span>
                      <span className="numeric shrink-0 text-muted-foreground">{formatCurrency(c.amount)}</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={c.label}
                      className="h-2 w-full overflow-hidden rounded-full bg-accent/20"
                    >
                      <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${percent}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
