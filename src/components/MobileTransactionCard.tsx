import { Edit, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "./ui/button";
import { formatCurrency } from "../lib/format";
import { getCategoryIcon } from "../lib/categoryIcon";
import { cn } from "../lib/utils";
import type { TransactionWithCat } from "../lib/transactions";

type MobileTransactionCardProps = {
  tx: TransactionWithCat;
  onEdit: (tx: TransactionWithCat) => void;
  onDelete: (tx: TransactionWithCat) => void;
};

/**
 * Deliberate mobile transaction presentation (not the desktop table
 * squeezed into a narrow viewport). Category, date, and note stay
 * compact; Edit/Delete are always-visible touch targets, not
 * hover/expand-revealed.
 */
export function MobileTransactionCard({ tx, onEdit, onDelete }: MobileTransactionCardProps) {
  const isIncome = tx.categories?.type === "income";
  const categoryName = tx.categories?.name ?? "Uncategorized";
  const date = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : "";
  const amountLabel = `${isIncome ? "+" : "-"}${formatCurrency(Math.abs(tx.amount))}`;
  const MerchantIcon = getCategoryIcon(categoryName);

  return (
    <li className="rounded-xl border border-border/20 bg-gradient-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-foreground/80"
          aria-hidden="true"
        >
          <MerchantIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{tx.merchant || categoryName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {categoryName} · {date}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-right">
          {isIncome ? (
            <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
          ) : (
            <TrendingDown className="h-4 w-4 text-destructive" aria-hidden="true" />
          )}
          <span
            className={cn(
              "font-semibold [font-variant-numeric:tabular-nums]",
              isIncome ? "text-success" : "text-destructive"
            )}
          >
            {amountLabel}
          </span>
        </div>
      </div>

      {tx.note && (
        <p className="mt-2 line-clamp-2 rounded-md bg-accent/20 p-2 text-sm text-muted-foreground">
          {tx.note}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2 border-t border-border/20 pt-3">
        <Button
          size="icon"
          variant="outline"
          aria-label={`Edit transaction: ${tx.merchant || categoryName}, ${amountLabel}`}
          onClick={() => onEdit(tx)}
        >
          <Edit className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          aria-label={`Delete transaction: ${tx.merchant || categoryName}, ${amountLabel}`}
          onClick={() => onDelete(tx)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
