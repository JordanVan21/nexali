import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import type { Transaction } from "@/mock/transactions";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryBadge, CategoryIconTile } from "./category-visuals";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TransactionCardProps = {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
};

/** Mobile app-style row card. */
export function TransactionCard({ transaction, onEdit, onDelete }: TransactionCardProps) {
  const t = transaction;
  return (
    <li className="nexali-panel rounded-xl p-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <CategoryIconTile category={t.category} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-foreground">{t.merchant}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="numeric">{formatShortDate(t.date)}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{t.type}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              "numeric text-right text-sm font-semibold",
              t.amount < 0 ? "text-destructive" : "text-success",
            )}
          >
            {formatCurrency(t.amount)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${t.merchant}`}
                className="grid h-10 w-8 place-items-center rounded-lg text-muted-foreground active:bg-surface-high"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => onEdit(t)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onDelete(t)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="mt-2 pl-[52px]">
        <CategoryBadge category={t.category} />
      </div>
    </li>
  );
}
