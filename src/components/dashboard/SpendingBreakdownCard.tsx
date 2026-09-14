import { Link } from "react-router-dom";
import { PieChart } from "lucide-react";
import { ChartCard } from "./ChartCard";
import { useFormatCurrency } from "../../features/profiles/useFormatPreferences";
import type { CategorySlice } from "../../features/dashboard/dashboardMath";

const DOT_TONES = ["bg-primary", "bg-success", "bg-warning", "bg-destructive"];

/** This month's real expense transactions, grouped by category (see dashboardMath.ts). */
export function SpendingBreakdownCard({ slices }: { slices: CategorySlice[] }) {
  const formatCurrency = useFormatCurrency();
  return (
    <ChartCard title="Top Spending" description="Where this month's money went">
      {slices.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <PieChart className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No expenses recorded yet this month.</p>
        </div>
      ) : (
        <ul className="flex-1 space-y-5">
          {slices.map((s, i) => (
            <li key={s.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-foreground">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_TONES[i % DOT_TONES.length]}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="numeric shrink-0 text-muted-foreground">{formatCurrency(s.amount)}</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.round(s.percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${s.label}: ${Math.round(s.percent)}% of this month's expenses`}
                className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
              >
                <div
                  className={`h-full rounded-full ${DOT_TONES[i % DOT_TONES.length]}`}
                  style={{ width: `${s.percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/transactions"
        className="mt-6 flex w-full items-center justify-center rounded-lg border border-outline-variant py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        View All Transactions
      </Link>
    </ChartCard>
  );
}
