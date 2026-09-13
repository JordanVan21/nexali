import { Link } from "react-router-dom";
import { ChartCard } from "./ChartCard";
import { getCategoryIcon } from "../../lib/categoryIcon";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { TransactionWithCat } from "../../lib/transactions";

/** The Dashboard's most recent transactions, reusing the same real transaction data and category icons as the Transactions page (see src/lib/categoryIcon.ts) — not a second transaction UI. */
export function RecentActivityList({ items }: { items: TransactionWithCat[] }) {
  return (
    <ChartCard
      title="Recent Activity"
      className="md:col-span-2 lg:col-span-1"
      actions={
        <Link to="/transactions" className="text-sm font-medium text-primary hover:underline">
          View All
        </Link>
      }
    >
      <ul className="scroll-slim max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
        {items.map((item) => {
          const categoryName = item.categories?.name ?? "Uncategorized";
          const isIncome = item.categories?.type === "income";
          const Icon = getCategoryIcon(categoryName);
          return (
            <li key={item.id}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-3 transition-colors hover:bg-surface-high">
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                    isIncome ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.merchant || categoryName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"} • {categoryName}
                  </span>
                </span>
                <span
                  className={cn(
                    "numeric shrink-0 text-sm font-medium",
                    isIncome ? "text-success" : "text-foreground"
                  )}
                >
                  {isIncome ? "+" : "-"}
                  {formatCurrency(Number(item.amount))}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
