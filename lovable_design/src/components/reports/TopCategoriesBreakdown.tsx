import { Car, Heart, Home, Plane, ShoppingBag, Utensils, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { TopCategory } from "@/mock/reports";

const ICONS: Record<TopCategory["icon"], LucideIcon> = {
  home: Home,
  utensils: Utensils,
  car: Car,
  plane: Plane,
  "shopping-bag": ShoppingBag,
  "heart-pulse": Heart,
};

const TONE_CLASSES: Record<TopCategory["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

function ChangeBadge({ percent }: { percent: number }) {
  const up = percent >= 0;
  return (
    <span className={cn("text-xs font-medium", up ? "text-destructive" : "text-success")}>
      {up ? "+" : ""}
      {percent.toFixed(1)}% vs last mo.
    </span>
  );
}

export function TopCategoriesBreakdown({ categories }: { categories: TopCategory[] }) {
  return (
    <div className="nexali-panel overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-border p-4 sm:p-6">
        <h3 className="font-display text-lg font-semibold text-foreground">Top Categories</h3>
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Category</th>
              <th>Transactions</th>
              <th>Amount</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((c) => {
              const Icon = ICONS[c.icon];
              return (
                <tr key={c.id} className="transition-colors hover:bg-surface-high/40">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                          TONE_CLASSES[c.tone],
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.transactions} Transactions
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <p className="numeric font-medium text-foreground">
                      {formatCurrency(c.amount, { signed: false })}
                    </p>
                    <ChangeBadge percent={c.changePercent} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="divide-y divide-border md:hidden">
        {categories.map((c) => {
          const Icon = ICONS[c.icon];
          return (
            <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                    TONE_CLASSES[c.tone],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.transactions} Transactions</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="numeric font-medium text-foreground">
                  {formatCurrency(c.amount, { signed: false })}
                </p>
                <ChangeBadge percent={c.changePercent} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
