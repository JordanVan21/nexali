import { Link } from "@tanstack/react-router";
import { ChartCard } from "./ChartCard";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetSnapshotItem } from "@/mock/dashboard";

const barTone: Record<BudgetSnapshotItem["tone"], string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

const statusLabel: Record<BudgetSnapshotItem["tone"], string> = {
  primary: "On track",
  success: "On track",
  warning: "Near limit",
  destructive: "Over budget",
};

export function BudgetSnapshot({ items }: { items: BudgetSnapshotItem[] }) {
  return (
    <ChartCard
      title="Budget Snapshot"
      description="Progress across your active budgets"
      className="md:col-span-2"
      actions={
        <Link to="/budgets" className="text-sm font-medium text-primary hover:underline">
          Manage Budgets
        </Link>
      }
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const percent = Math.min(100, Math.round((item.spent / item.limit) * 100));
          return (
            <li key={item.id} className="rounded-lg border border-outline-variant/60 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{item.category}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium",
                    item.tone === "destructive"
                      ? "text-destructive"
                      : item.tone === "warning"
                        ? "text-warning"
                        : "text-success",
                  )}
                >
                  {statusLabel[item.tone]}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.category} budget usage`}
                className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
              >
                <div className={cn("h-full rounded-full", barTone[item.tone])} style={{ width: `${percent}%` }} />
              </div>
              <p className="numeric mt-2 text-xs text-muted-foreground">
                {formatCurrency(item.spent, { signed: false })} of {formatCurrency(item.limit, { signed: false })}
              </p>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
