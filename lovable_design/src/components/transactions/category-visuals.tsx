import {
  Banknote,
  Car,
  Coffee,
  Gift,
  Home,
  Plane,
  ShoppingCart,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { CategoryTone, TransactionCategory } from "@/mock/transactions";

const icons: Record<TransactionCategory["icon"], LucideIcon> = {
  cart: ShoppingCart,
  bolt: Zap,
  bank: Banknote,
  car: Car,
  coffee: Coffee,
  home: Home,
  gift: Gift,
  plane: Plane,
};

export function categoryIcon(key: TransactionCategory["icon"]): LucideIcon {
  return icons[key] ?? ShoppingCart;
}

export const toneText: Record<CategoryTone, string> = {
  success: "text-success",
  warning: "text-warning",
  primary: "text-primary",
  neutral: "text-muted-foreground",
};

export const toneBadge: Record<CategoryTone, string> = {
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  primary: "border-primary/25 bg-primary/10 text-primary",
  neutral: "border-outline-variant bg-surface-high text-muted-foreground",
};

export function CategoryBadge({ category }: { category: TransactionCategory }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneBadge[category.tone]}`}
    >
      {category.name}
    </span>
  );
}

export function CategoryIconTile({
  category,
  size = "md",
}: {
  category: TransactionCategory;
  size?: "sm" | "md";
}) {
  const Icon = categoryIcon(category.icon);
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-lg bg-surface-highest ${toneText[category.tone]} ${
        size === "sm" ? "h-9 w-9" : "h-10 w-10"
      }`}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} />
    </span>
  );
}
