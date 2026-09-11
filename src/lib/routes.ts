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
  type LucideIcon,
} from "lucide-react";

export type NavRoute = {
  /** Visible label used in navigation and as the mobile header page title. */
  label: string;
  path: string;
  icon: LucideIcon;
  /** Shown as a labelled item in the desktop/tablet center navigation. */
  desktopPrimary: boolean;
  /** Shown as one of the fixed mobile bottom-nav tabs. A subset of desktopPrimary. */
  mobileBottomNav: boolean;
  /** Listed in the mobile hamburger menu. True for every real destination. */
  mobileMenu: boolean;
};

export const NAV_ROUTES: NavRoute[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    desktopPrimary: true,
    mobileBottomNav: true,
    mobileMenu: true,
  },
  {
    label: "Transactions",
    path: "/transactions",
    icon: ArrowLeftRight,
    desktopPrimary: true,
    mobileBottomNav: true,
    mobileMenu: true,
  },
  {
    label: "Budgets",
    path: "/budgets",
    icon: PiggyBank,
    desktopPrimary: true,
    mobileBottomNav: true,
    mobileMenu: true,
  },
  {
    label: "Reports",
    path: "/reports",
    icon: BarChart3,
    desktopPrimary: true,
    mobileBottomNav: false,
    mobileMenu: true,
  },
  {
    label: "Aura",
    path: "/assistant",
    icon: Sparkles,
    desktopPrimary: true,
    mobileBottomNav: true,
    mobileMenu: true,
  },
  {
    label: "Notifications",
    path: "/notifications",
    icon: Bell,
    desktopPrimary: false,
    mobileBottomNav: false,
    mobileMenu: true,
  },
  {
    label: "Profile",
    path: "/profile",
    icon: User,
    desktopPrimary: false,
    mobileBottomNav: false,
    mobileMenu: true,
  },
  {
    label: "Account",
    path: "/account",
    icon: ShieldCheck,
    desktopPrimary: false,
    mobileBottomNav: false,
    mobileMenu: true,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: SettingsIcon,
    desktopPrimary: false,
    mobileBottomNav: false,
    mobileMenu: true,
  },
];

export const desktopPrimaryRoutes = NAV_ROUTES.filter((r) => r.desktopPrimary);
export const mobileBottomNavRoutes = NAV_ROUTES.filter((r) => r.mobileBottomNav);
export const mobileMenuPrimaryRoutes = desktopPrimaryRoutes;
export const mobileMenuSecondaryRoutes = NAV_ROUTES.filter(
  (r) => !r.desktopPrimary && r.mobileMenu
);

/** Routes that live under the mobile bottom nav's "More" tab. */
export const secondaryRoutePaths = new Set(
  NAV_ROUTES.filter((r) => !r.mobileBottomNav).map((r) => r.path)
);

export function isRouteActive(pathname: string, path: string): boolean {
  return pathname === path;
}

/** True when the current pathname belongs to one of the "More" (secondary) destinations. */
export function isSecondaryRouteActive(pathname: string): boolean {
  return secondaryRoutePaths.has(pathname);
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
