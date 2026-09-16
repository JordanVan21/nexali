import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  BarChart3,
  Sparkles,
  Bell,
  User,
  ShieldCheck,
  Settings as SettingsIcon,
  Receipt,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavRoute = {
  /** Visible label used in navigation and as the mobile header page title. */
  label: string;
  /** Shorter label shown in the desktop nav at tablet (md) width only, where
   * five full labels plus the logo and right-side controls don't fit
   * comfortably. Falls back to `label` when unset. */
  shortLabel?: string;
  path: string;
  icon: LucideIcon;
  /** Shown as a labelled item in the desktop/tablet center navigation. */
  desktopPrimary: boolean;
  /** Shown as one of the fixed mobile bottom-nav tabs. Same five destinations as desktopPrimary. */
  mobileBottomNav: boolean;
};

export const NAV_ROUTES: NavRoute[] = [
  {
    label: "Dashboard",
    shortLabel: "Home",
    path: "/dashboard",
    icon: LayoutDashboard,
    desktopPrimary: true,
    mobileBottomNav: true,
  },
  {
    label: "Transactions",
    shortLabel: "Activity",
    path: "/transactions",
    icon: ArrowLeftRight,
    desktopPrimary: true,
    mobileBottomNav: true,
  },
  {
    label: "Budgets",
    path: "/budgets",
    icon: PiggyBank,
    desktopPrimary: true,
    mobileBottomNav: true,
  },
  {
    label: "Reports",
    path: "/reports",
    icon: BarChart3,
    desktopPrimary: true,
    mobileBottomNav: true,
  },
  {
    // Product name is "Aura"; the route itself stays "/assistant" (see the
    // Part 2 nav report's routing decision) with a "/aura" redirect alias
    // registered alongside the authenticated routes in main.tsx.
    label: "Aura",
    path: "/assistant",
    icon: Sparkles,
    desktopPrimary: true,
    mobileBottomNav: true,
  },
  {
    label: "Notifications",
    path: "/notifications",
    icon: Bell,
    desktopPrimary: false,
    mobileBottomNav: false,
  },
  {
    // Frontend-only Split Expenses workflow -- see
    // docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry for why this is
    // NOT a primary desktop/mobile-bottom-nav destination (avoiding
    // crowding the existing five-item primary nav): it's reached instead
    // via the account menu (ProfileMenu/MobileProfileMenu) and a
    // Transactions-page contextual CTA.
    label: "Split Expenses",
    shortLabel: "Split",
    path: "/split",
    icon: Receipt,
    desktopPrimary: false,
    mobileBottomNav: false,
  },
  {
    // Frontend placeholder only -- the real Friends feature (and its own
    // primary-nav case, if any) is a future backend phase. Given its own
    // dedicated icon in AppNav/MobileHeader per that Part's explicit
    // requirement, distinct from the account-menu utility routes below.
    label: "Friends",
    path: "/friends",
    icon: UsersRound,
    desktopPrimary: false,
    mobileBottomNav: false,
  },
  {
    label: "Profile",
    path: "/profile",
    icon: User,
    desktopPrimary: false,
    mobileBottomNav: false,
  },
  {
    label: "Account",
    path: "/account",
    icon: ShieldCheck,
    desktopPrimary: false,
    mobileBottomNav: false,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: SettingsIcon,
    desktopPrimary: false,
    mobileBottomNav: false,
  },
];

export const desktopPrimaryRoutes = NAV_ROUTES.filter((r) => r.desktopPrimary);
export const mobileBottomNavRoutes = NAV_ROUTES.filter((r) => r.mobileBottomNav);

export function isRouteActive(pathname: string, path: string): boolean {
  return pathname === path;
}

export function findRouteByPath(pathname: string): NavRoute | undefined {
  return NAV_ROUTES.find((r) => r.path === pathname);
}

/** Public (unauthenticated) route paths, kept alongside NAV_ROUTES as the single source of truth for route strings. */
export const PUBLIC_ROUTES = {
  landing: "/",
  signIn: "/signin",
  signUp: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
} as const;

/** Where an authenticated user lands when there is no more specific destination. */
export const DEFAULT_AUTHENTICATED_ROUTE = "/dashboard";

/** Query param AuthGate uses to preserve the originally requested route across a sign-in. */
export const REDIRECT_PARAM = "redirect";

/**
 * Validates that a redirect target is an internal application path before it
 * is ever used for navigation. Rejects anything that could send the user to
 * an external site: absolute URLs, protocol-relative URLs ("//host"),
 * backslash tricks, and embedded schemes (javascript:, https:, etc). Only a
 * string starting with exactly one "/" is accepted.
 */
export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_ROUTE
): string {
  if (!candidate) return fallback;
  if (candidate[0] !== "/") return fallback;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  if (candidate.includes("://")) return fallback;
  return candidate;
}
