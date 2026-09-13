import { Edit, MoreHorizontal, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdownMenu";
import { formatCurrency } from "../lib/format";
import { getCategoryIcon, getCategoryIconClass, getCategoryBadgeClass } from "../lib/categoryIcon";
import { cn } from "../lib/utils";
import type { TransactionWithCat } from "../lib/transactions";

type MobileTransactionCardProps = {
  tx: TransactionWithCat;
  onEdit: (tx: TransactionWithCat) => void;
  onDelete: (tx: TransactionWithCat) => void;
};

/**
 * Deliberate mobile transaction presentation (not the desktop table
 * squeezed into a narrow viewport), matching the Lovable reference's
 * TransactionCard: icon tile + merchant/date/type, amount, and a single
 * Actions menu rather than separate always-visible Edit/Delete buttons.
 */
export function MobileTransactionCard({ tx, onEdit, onDelete }: MobileTransactionCardProps) {
  const isIncome = tx.categories?.type === "income";
  const categoryName = tx.categories?.name ?? "Uncategorized";
  const date = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : "";
  const amountLabel = `${isIncome ? "+" : "-"}${formatCurrency(Math.abs(tx.amount))}`;
  const MerchantIcon = getCategoryIcon(categoryName);
  const toneText = getCategoryIconClass(categoryName);
  const toneBadge = getCategoryBadgeClass(categoryName);
  const label = tx.merchant || categoryName;

  return (
    <li className="nexali-panel rounded-xl p-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-highest", toneText)}
          aria-hidden="true"
        >
          <MerchantIcon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="numeric">{date}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 truncate">
              {isIncome ? (
                <TrendingUp className="h-3 w-3 text-success" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" aria-hidden="true" />
              )}
              {isIncome ? "Income" : "Expense"}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn("numeric text-right text-sm font-semibold", isIncome ? "text-success" : "text-destructive")}
          >
            {amountLabel}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-8"
                aria-label={`Actions for ${label}`}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onEdit(tx)}>
                <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(tx)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-2 pl-[52px]">
        <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", toneBadge)}>
          {categoryName}
        </span>
      </div>

      {tx.note && (
        <p className="mt-2 line-clamp-2 rounded-md bg-accent/20 p-2 pl-3 text-sm text-muted-foreground">{tx.note}</p>
      )}
    </li>
  );
}
