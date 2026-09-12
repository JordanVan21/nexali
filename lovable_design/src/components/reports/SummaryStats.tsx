import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

type Stat = {
  id: string;
  label: string;
  value: number;
  icon: typeof Wallet;
  tone: "primary" | "success" | "warning";
  suffix?: string;
};

export function SummaryStats({
  totalIncome,
  totalExpenses,
  netSavings,
  savingsRatePercent,
}: {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRatePercent: number;
}) {
  const stats: Stat[] = [
    { id: "income", label: "Total Income", value: totalIncome, icon: ArrowUpRight, tone: "success" },
    { id: "expenses", label: "Total Expenses", value: totalExpenses, icon: ArrowDownRight, tone: "warning" },
    { id: "savings", label: "Net Savings", value: netSavings, icon: PiggyBank, tone: "primary" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.id} className="nexali-panel min-w-0 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.label}
            </span>
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                s.tone === "success" && "bg-success/10 text-success",
                s.tone === "warning" && "bg-warning/10 text-warning",
                s.tone === "primary" && "bg-primary/10 text-primary",
              )}
            >
              <s.icon className="h-4 w-4" />
            </span>
          </div>
          <p className="numeric mt-3 truncate text-2xl font-semibold text-foreground">
            {formatCurrency(s.value, { signed: false })}
          </p>
        </div>
      ))}

      <div className="nexali-panel min-w-0 rounded-xl p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Savings Rate
          </span>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/10 text-success">
            <Wallet className="h-4 w-4" />
          </span>
        </div>
        <p className="numeric mt-3 truncate text-2xl font-semibold text-success">
          {savingsRatePercent.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
