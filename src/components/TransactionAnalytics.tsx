import { Link } from "react-router-dom";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useUserInfo } from "../shared/useUserId";
import { useTransactions } from "../features/transactions/useTransactions";
import { formatCurrency } from "../lib/format";
import { getErrorMessage, cn } from "../lib/utils";
import { Skeleton } from "./states/Skeleton";
import { ErrorState } from "./states/ErrorState";
import { resolveBurnPeriod, computeDailyBurn, topExpenseCategories, dailyExpenseBuckets } from "../lib/transactionsAnalytics";
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
 * Average Daily Burn and Top Categories. Both are computed client-side from
 * the same unbounded real transaction set the filter bar already loads
 * (features/transactions/useTransactions -- shares one cached fetch via
 * TanStack Query, so this does not add a second network request), scoped to
 * `resolveBurnPeriod` (the active date filter, or the current month to
 * date). No AI, no fabricated trend, no mock category labels.
 */
export function TransactionAnalytics({ filters }: { filters: Filters }) {
  const { userId } = useUserInfo();
  const txQuery = useTransactions(userId);

  if (txQuery.isLoading) return <AnalyticsSkeleton />;

  if (txQuery.isError) {
    return (
      <ErrorState
        title="Couldn't load your activity summary"
        message={getErrorMessage(txQuery.error, "Please try again.")}
        onRetry={() => txQuery.refetch()}
      />
    );
  }

  const transactions = txQuery.data ?? [];
  const period = resolveBurnPeriod(filters.fromISO, filters.toISO);
  const burn = computeDailyBurn(transactions, period);
  const categories = topExpenseCategories(transactions, period, 4);
  const buckets = dailyExpenseBuckets(transactions, period);
  const maxBucket = Math.max(0, ...buckets.map((b) => b.amount));
  const up = burn.changePercent !== null && burn.changePercent > 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Based on real expense transactions for {period.label}. Independent of the search, category, type, and amount
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
                {formatCurrency(burn.dailyRate)}
                <span
                  className={cn(
                    "text-sm font-medium",
                    burn.changePercent === null ? "text-muted-foreground" : up ? "text-destructive" : "text-success"
                  )}
                >
                  {burn.changePercent === null
                    ? "No previous-period data"
                    : `${up ? "+" : "−"}${Math.abs(Math.round(burn.changePercent))}% vs previous period`}
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
