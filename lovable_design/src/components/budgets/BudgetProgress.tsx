import { cn } from "@/lib/utils";
import type { BudgetStatus } from "@/mock/budgets";

const barTone: Record<BudgetStatus, string> = {
  "on-track": "bg-success",
  warning: "bg-warning",
  "over-budget": "bg-destructive",
};

export function BudgetProgress({
  percent,
  status,
  label,
}: {
  percent: number;
  status: BudgetStatus;
  label: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
    >
      <div className={cn("h-full rounded-full transition-all", barTone[status])} style={{ width: `${clamped}%` }} />
    </div>
  );
}
