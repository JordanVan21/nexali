import { Car, Gift, Home, MoreVertical, Pencil, Plane, PiggyBank, ShoppingCart, Trash2, Utensils, Zap, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { budgetStatusLabel, getBudgetStatus, type Budget } from "@/mock/budgets";
import { BudgetProgress } from "./BudgetProgress";

const iconMap: Record<Budget["icon"], LucideIcon> = {
  home: Home,
  restaurant: Utensils,
  car: Car,
  savings: PiggyBank,
  cart: ShoppingCart,
  bolt: Zap,
  plane: Plane,
  gift: Gift,
};

const toneClasses = {
  "on-track": { icon: "bg-success/10 text-success", text: "text-success" },
  warning: { icon: "bg-warning/10 text-warning", text: "text-warning" },
  "over-budget": { icon: "bg-destructive/10 text-destructive", text: "text-destructive" },
};

export function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
}) {
  const Icon = iconMap[budget.icon];
  const status = getBudgetStatus(budget.spent, budget.limit);
  const percent = budget.limit > 0 ? Math.round((budget.spent / budget.limit) * 100) : 0;
  const remaining = budget.limit - budget.spent;
  const tone = toneClasses[status];

  return (
    <div className="nexali-panel flex flex-col gap-4 rounded-xl p-5 transition-colors hover:border-primary/40">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg", tone.icon)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold text-foreground">{budget.category}</h3>
            <p className="truncate text-xs text-muted-foreground">{budget.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={cn("text-xs font-semibold", tone.text)}>{percent}%</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                aria-label={`Actions for ${budget.category}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(budget)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(budget)} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="numeric text-muted-foreground">Spent: {formatCurrency(budget.spent, { signed: false })}</span>
          <span className="numeric text-foreground">Limit: {formatCurrency(budget.limit, { signed: false })}</span>
        </div>
        <BudgetProgress percent={percent} status={status} label={`${budget.category} budget usage`} />
      </div>

      <div className="flex items-center justify-between border-t border-outline-variant pt-3">
        <span className={cn("text-xs font-medium", tone.text)}>{budgetStatusLabel[status]}</span>
        <span className={cn("numeric text-sm font-semibold", remaining < 0 ? "text-destructive" : "text-foreground")}>
          {remaining < 0 ? "Over by " : "Remaining "}
          {formatCurrency(Math.abs(remaining), { signed: false })}
        </span>
      </div>
    </div>
  );
}
