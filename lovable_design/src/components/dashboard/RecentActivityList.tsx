import { Link } from "@tanstack/react-router";
import { Banknote, Bolt, Car, Coffee, Home, Plane, ShoppingCart, type LucideIcon } from "lucide-react";

import { ChartCard } from "./ChartCard";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/mock/dashboard";

const icons: Record<ActivityItem["icon"], LucideIcon> = {
  cart: ShoppingCart,
  bank: Banknote,
  car: Car,
  coffee: Coffee,
  home: Home,
  bolt: Bolt,
  plane: Plane,
};

export function RecentActivityList({ items }: { items: ActivityItem[] }) {
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
          const Icon = icons[item.icon];
          const isIncome = item.amount > 0;
          return (
            <li key={item.id}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-3 transition-colors hover:bg-surface-high">
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                    isIncome ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{item.merchant}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatShortDate(item.date)} • {item.category}
                  </span>
                </span>
                <span
                  className={cn(
                    "numeric shrink-0 text-sm font-medium",
                    isIncome ? "text-success" : "text-foreground",
                  )}
                >
                  {formatCurrency(item.amount)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
