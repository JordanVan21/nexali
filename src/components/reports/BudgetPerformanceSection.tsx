import { Link } from "react-router-dom";
import { PiggyBank } from "lucide-react";
import { Button } from "../ui/button";
import { BudgetProgressBar } from "../budgets/BudgetProgressBar";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { BudgetProgressDetail, BudgetStatus } from "../../lib/budgetMath";

const statusLabel: Record<BudgetStatus, string> = {
  normal: "On track",
  warning: "Approaching limit",
  critical: "Near limit",
  over: "Over budget",
};

const statusTextTone: Record<BudgetStatus, string> = {
  normal: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
  over: "text-destructive",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Real budgets (period-correct spend via src/lib/budgetMath.ts) whose
 * month/year falls in the selected report range, grouped by month rather
 * than blended into one figure — summing or averaging percentages across
 * different months' budgets would not be a meaningful number.
 */
export function BudgetPerformanceSection({ budgets }: { budgets: BudgetProgressDetail[] }) {
  if (budgets.length === 0) {
    return (
      <div className="nexali-panel flex flex-col items-center justify-center gap-3 rounded-xl p-8 text-center">
        <PiggyBank className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">No budgets were set for this period.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/budgets">Create Budget</Link>
        </Button>
      </div>
    );
  }

  const byMonth = new Map<string, BudgetProgressDetail[]>();
  for (const b of budgets) {
    const key = `${MONTH_NAMES[b.month - 1]} ${b.year}`;
    const list = byMonth.get(key);
    if (list) list.push(b);
    else byMonth.set(key, [b]);
  }

  return (
    <div className="nexali-panel rounded-xl p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground lg:text-xl xl:text-2xl">Budget Performance</h2>
        <Link to="/budgets" className="text-sm font-medium text-primary hover:underline">
          Manage Budgets
        </Link>
      </div>

      <div className="space-y-6">
        {Array.from(byMonth.entries()).map(([monthLabel, items]) => (
          <div key={monthLabel}>
            {byMonth.size > 1 && <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{monthLabel}</h3>}
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((b) => (
                <li key={b.id} className="rounded-lg border border-outline-variant/60 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{b.category}</span>
                    <span className={cn("shrink-0 text-xs font-medium", statusTextTone[b.status])}>{statusLabel[b.status]}</span>
                  </div>
                  <BudgetProgressBar displayPercent={b.displayPercent} status={b.status} label={`${b.category} budget usage: ${statusLabel[b.status]}`} />
                  <p className="numeric mt-2 text-xs text-muted-foreground">
                    {formatCurrency(b.spent)} of {formatCurrency(b.amount)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
