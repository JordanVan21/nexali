import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  BarChart3,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type AppRoutePath =
  | "/dashboard"
  | "/transactions"
  | "/budgets"
  | "/reports"
  | "/aura"
  | "/profile"
  | "/account"
  | "/settings"
  | "/notifications";

export type NavItem = {
  key: string;
  label: string;
  /** Shorter label used on narrow tablet widths. */
  shortLabel?: string;
  icon: LucideIcon;
  to: AppRoutePath;
};

/** Shared across desktop top nav and mobile bottom nav. */
export const primaryNavItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, to: "/dashboard" },
  { key: "transactions", label: "Transactions", shortLabel: "Activity", icon: ArrowLeftRight, to: "/transactions" },
  { key: "budgets", label: "Budgets", icon: PiggyBank, to: "/budgets" },
  { key: "reports", label: "Reports", icon: BarChart3, to: "/reports" },
  { key: "aura", label: "Aura", icon: Sparkles, to: "/aura" },
];

/** Mobile bottom nav mirrors the desktop primary rail, in the same order. */
export const mobileBottomNavKeys = primaryNavItems.map((item) => item.key);
