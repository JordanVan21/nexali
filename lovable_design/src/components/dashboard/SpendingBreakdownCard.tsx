import { Link } from "@tanstack/react-router";
import { ChartCard } from "./ChartCard";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SpendingSlice } from "@/mock/dashboard";

const dotTone: Record<SpendingSlice["tone"], string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-outline-variant",
};

const barTone: Record<SpendingSlice["tone"], string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-outline-variant",
};

export function SpendingBreakdownCard({ slices }: { slices: SpendingSlice[] }) {
  return (
    <ChartCard title="Top Spending" description="Where this month's money went">
      <ul className="flex-1 space-y-5">
        {slices.map((s) => (
          <li key={s.id} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-foreground">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotTone[s.tone])} aria-hidden="true" />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="numeric shrink-0 text-muted-foreground">
                {formatCurrency(s.amount, { signed: false })}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={s.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={s.label}
              className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
            >
              <div className={cn("h-full rounded-full", barTone[s.tone])} style={{ width: `${s.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <Link
        to="/transactions"
        className="mt-6 flex w-full items-center justify-center rounded-lg border border-outline-variant py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Full Categorical Report
      </Link>
    </ChartCard>
  );
}
