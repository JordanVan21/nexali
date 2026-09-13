import type { BudgetStatus } from "../../lib/budgetMath";

const barTone: Record<BudgetStatus, string> = {
  normal: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
  over: "bg-destructive",
};

export function BudgetProgressBar({
  displayPercent,
  status,
  label,
}: {
  displayPercent: number;
  status: BudgetStatus;
  label: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={displayPercent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
    >
      <div className={`h-full rounded-full transition-all ${barTone[status]}`} style={{ width: `${displayPercent}%` }} />
    </div>
  );
}
