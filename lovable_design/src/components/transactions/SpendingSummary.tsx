import { TrendingUp } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SummaryTone = "primary" | "success" | "warning";

const barTone: Record<SummaryTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
};

export function DailyBurnCard({
  amount,
  changePercent,
  sparkline,
}: {
  amount: number;
  changePercent: number;
  sparkline: number[];
}) {
  const up = changePercent >= 0;
  const peak = Math.max(...sparkline);

  return (
    <section className="nexali-panel group rounded-xl p-5" aria-labelledby="daily-burn-heading">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="daily-burn-heading"
            className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Average Daily Burn
          </h2>
          <p className="font-display mt-1 flex flex-wrap items-baseline gap-2 text-[28px] font-bold leading-tight text-foreground">
            {formatCurrency(amount, { signed: false })}
            <span
              className={cn("text-sm font-medium", up ? "text-destructive" : "text-success")}
            >
              {up ? "+" : "−"}
              {Math.abs(changePercent)}% vs last month
            </span>
          </p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
          <TrendingUp className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-5 flex h-16 items-end gap-1" aria-hidden="true">
        {sparkline.map((v, i) => (
          <div
            key={i}
            style={{ height: `${v}%` }}
            className={cn(
              "flex-1 rounded-t-sm transition-colors",
              v === peak ? "bg-primary/70" : "bg-outline-variant/40 group-hover:bg-primary/30",
            )}
          />
        ))}
      </div>
    </section>
  );
}

export function TopCategoriesCard({
  categories,
}: {
  categories: { id: string; label: string; percent: number; tone: SummaryTone }[];
}) {
  return (
    <section className="nexali-panel rounded-xl p-5" aria-labelledby="top-categories-heading">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="top-categories-heading"
          className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Top Categories
        </h2>
        <button type="button" className="text-sm font-medium text-primary hover:underline">
          View All
        </button>
      </div>
      <ul className="mt-4 space-y-4">
        {categories.map((c) => (
          <li key={c.id}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-foreground">{c.label}</span>
              <span className="numeric shrink-0 text-muted-foreground">{c.percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={c.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={c.label}
              className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
            >
              <div className={cn("h-full rounded-full", barTone[c.tone])} style={{ width: `${c.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
