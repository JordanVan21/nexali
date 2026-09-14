import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdownMenu";
import { getCategoryIcon } from "../../lib/categoryIcon";
import { useFormatCurrency } from "../../features/profiles/useFormatPreferences";
import { cn } from "../../lib/utils";
import type { BudgetProgressDetail, BudgetStatus } from "../../lib/budgetMath";
import { BudgetProgressBar } from "./BudgetProgressBar";

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

const statusIconTone: Record<BudgetStatus, string> = {
  normal: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
  over: "bg-destructive/10 text-destructive",
};

/**
 * Real budget progress, computed from the user's actual transactions for
 * this budget's own month/year (src/lib/budgetMath.ts) — never the
 * all-time `sum_category_amount` RPC. Category icon reuses the same
 * deterministic lookup as Transactions/Dashboard (no invented database
 * category icon/color exists).
 */
export function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: BudgetProgressDetail;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const formatCurrency = useFormatCurrency();
  const Icon = getCategoryIcon(budget.category);

  return (
    <div className="nexali-panel flex flex-col gap-4 rounded-xl p-5 transition-colors hover:border-primary/40 xl:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg xl:h-12 xl:w-12", statusIconTone[budget.status])}>
            <Icon className="h-5 w-5 xl:h-6 xl:w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold text-foreground xl:text-lg">{budget.category}</h3>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={cn("numeric text-xs font-semibold", statusTextTone[budget.status])}>
            {Math.round(budget.actualPercent)}%
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                aria-label={`Actions for ${budget.category}`}
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} className="flex items-center gap-2 cursor-pointer">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="numeric text-muted-foreground">Spent: {formatCurrency(budget.spent)}</span>
          <span className="numeric text-foreground">Limit: {formatCurrency(budget.amount)}</span>
        </div>
        <BudgetProgressBar
          displayPercent={budget.displayPercent}
          status={budget.status}
          label={`${budget.category} budget usage: ${statusLabel[budget.status]}`}
        />
      </div>

      <div className="flex items-center justify-between border-t border-outline-variant pt-3">
        <span className={cn("text-xs font-medium", statusTextTone[budget.status])}>{statusLabel[budget.status]}</span>
        <span className={cn("numeric text-sm font-semibold", budget.isOverBudget ? "text-destructive" : "text-foreground")}>
          {budget.isOverBudget ? "Over by " : "Remaining "}
          {formatCurrency(Math.abs(budget.remaining))}
        </span>
      </div>
    </div>
  );
}
