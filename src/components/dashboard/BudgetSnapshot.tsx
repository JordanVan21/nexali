import { Link } from "react-router-dom";
import { PiggyBank } from "lucide-react";
import { ChartCard } from "./ChartCard";
import { Button } from "../ui/button";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { BudgetProgress } from "../../features/dashboard/dashboardMath";

const barTone: Record<BudgetProgress["tone"], string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

const statusLabel: Record<BudgetProgress["tone"], string> = {
  success: "On track",
  warning: "Near limit",
  destructive: "Over budget",
};

const statusTextTone: Record<BudgetProgress["tone"], string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

/** Real budgets for the current month/year, with spend computed from this month's actual transactions (see dashboardMath.ts) — not the all-time sum_category_amount RPC. */
export function BudgetSnapshot({ items }: { items: BudgetProgress[] }) {
  return (
    <ChartCard
      title="Budget Snapshot"
      description="Progress across this month's budgets"
      className="md:col-span-3"
      actions={
        <Link to="/budgets" className="text-sm font-medium text-primary hover:underline">
          Manage Budgets
        </Link>
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <PiggyBank className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No budgets set for this month yet.</p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/budgets">Create Budget</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-outline-variant/60 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{item.category}</span>
                <span className={cn("shrink-0 text-xs font-medium", statusTextTone[item.tone])}>
                  {statusLabel[item.tone]}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={item.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.category} budget usage: ${statusLabel[item.tone]}`}
                className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
              >
                <div className={cn("h-full rounded-full", barTone[item.tone])} style={{ width: `${item.percent}%` }} />
              </div>
              <p className="numeric mt-2 text-xs text-muted-foreground">
                {formatCurrency(item.spent)} of {formatCurrency(item.limit)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
