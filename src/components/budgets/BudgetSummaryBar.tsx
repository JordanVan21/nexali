import { Gauge, PiggyBank, Wallet, type LucideIcon } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { BudgetsPeriodSummary } from "../../features/budgets/useBudgetsForPeriod";

/**
 * Real aggregate totals for the selected period only (see
 * useBudgetsForPeriod.ts) — never mixes budgets from other months into
 * these sums. Efficiency is shown unclamped (can exceed 100%) rather than
 * silently capping a genuinely over-budget period at "100%".
 */
export function BudgetSummaryBar({ totalBudget, available, efficiency }: BudgetsPeriodSummary) {
  const stats: { id: string; icon: LucideIcon; label: string; value: string; valueClass: string }[] = [
    {
      id: "total",
      icon: Wallet,
      label: "Total Budgeted",
      value: formatCurrency(totalBudget),
      valueClass: "text-foreground",
    },
    {
      id: "available",
      icon: PiggyBank,
      label: "Available to Spend",
      value: formatCurrency(available),
      valueClass: available < 0 ? "text-destructive" : "text-success",
    },
    {
      id: "efficiency",
      icon: Gauge,
      label: "Spending Efficiency",
      value: `${Math.round(efficiency)}%`,
      valueClass: efficiency > 100 ? "text-destructive" : "text-warning",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((s) => (
        <div key={s.id} className="nexali-panel relative overflow-hidden rounded-xl p-5 lg:p-6 xl:p-7">
          <div className="relative z-10 space-y-2">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground lg:text-sm">
              <s.icon className="h-4 w-4" aria-hidden="true" />
              {s.label}
            </p>
            <p className={cn("numeric font-display text-[26px] font-bold sm:text-[32px]", s.valueClass)}>
              {s.value}
            </p>
          </div>
          <s.icon
            className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 text-foreground opacity-[0.04]"
            aria-hidden="true"
          />
        </div>
      ))}
    </div>
  );
}
