import { Gauge, PiggyBank, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BudgetSummaryBar({
  totalBudget,
  totalSpent,
  available,
}: {
  totalBudget: number;
  totalSpent: number;
  available: number;
}) {
  const efficiency = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  const stats = [
    {
      id: "total",
      icon: Wallet,
      label: "Total Monthly Budget",
      value: formatCurrency(totalBudget, { signed: false }),
      valueClass: "text-foreground",
    },
    {
      id: "available",
      icon: PiggyBank,
      label: "Available to Spend",
      value: formatCurrency(available, { signed: false }),
      valueClass: available < 0 ? "text-destructive" : "text-success",
    },
    {
      id: "efficiency",
      icon: Gauge,
      label: "Spending Efficiency",
      value: `${efficiency}%`,
      valueClass: "text-warning",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((s) => (
        <div key={s.id} className="nexali-panel relative overflow-hidden rounded-xl p-5">
          <div className="relative z-10 space-y-2">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <s.icon className="h-4 w-4" aria-hidden="true" />
              {s.label}
            </p>
            <p className={cn("numeric font-display text-[26px] font-bold sm:text-[32px]", s.valueClass)}>
              {s.value}
            </p>
          </div>
          <s.icon className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 text-foreground opacity-[0.04]" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
