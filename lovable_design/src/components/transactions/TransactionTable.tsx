import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import type { Transaction } from "@/mock/transactions";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryBadge, CategoryIconTile } from "./category-visuals";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TransactionTableProps = {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
};

/** Desktop + tablet table view. Tablet drops the Type column. */
export function TransactionTable({ transactions, onEdit, onDelete }: TransactionTableProps) {
  return (
    <div className="scroll-slim overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Transactions</caption>
        <thead>
          <tr className="border-b border-outline-variant/60 bg-surface-low/50">
            <th scope="col" className="px-4 py-3.5 text-sm font-medium text-muted-foreground lg:px-6">
              Date
            </th>
            <th scope="col" className="px-4 py-3.5 text-sm font-medium text-muted-foreground lg:px-6">
              Merchant
            </th>
            <th scope="col" className="px-4 py-3.5 text-sm font-medium text-muted-foreground lg:px-6">
              Category
            </th>
            <th
              scope="col"
              className="hidden px-4 py-3.5 text-sm font-medium text-muted-foreground lg:table-cell lg:px-6"
            >
              Type
            </th>
            <th
              scope="col"
              className="px-4 py-3.5 text-right text-sm font-medium text-muted-foreground lg:px-6"
            >
              Amount
            </th>
            <th scope="col" className="w-12 px-2 py-3.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/30">
          {transactions.map((t) => (
            <tr key={t.id} className="group transition-colors hover:bg-surface-high/40">
              <td className="numeric whitespace-nowrap px-4 py-4 text-sm text-muted-foreground lg:px-6">
                {formatDate(t.date)}
              </td>
              <td className="px-4 py-4 lg:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <CategoryIconTile category={t.category} />
                  <span className="truncate text-sm font-medium text-foreground">{t.merchant}</span>
                </div>
              </td>
              <td className="px-4 py-4 lg:px-6">
                <CategoryBadge category={t.category} />
                <span className="mt-1 block text-xs text-muted-foreground lg:hidden">{t.type}</span>
              </td>
              <td className="hidden px-4 py-4 text-sm text-muted-foreground lg:table-cell lg:px-6">
                {t.type}
              </td>
              <td
                className={cn(
                  "numeric whitespace-nowrap px-4 py-4 text-right text-sm lg:px-6",
                  t.amount < 0 ? "text-destructive" : "text-success",
                )}
              >
                {formatCurrency(t.amount)}
              </td>
              <td className="px-2 py-4 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Actions for ${t.merchant}`}
                      className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-highest hover:text-foreground"
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
