import { Link, useLocation } from "react-router-dom";
import { mobileBottomNavRoutes, isRouteActive } from "../../lib/routes";
import { cn } from "../../lib/utils";

const tabClass = (active: boolean) =>
  cn(
    "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg py-1 text-xs font-medium leading-tight transition-colors",
    "max-[340px]:gap-0.5 max-[340px]:text-[10px]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
  );

// A pill highlight behind the icon only (not the full tab width), matching
// dashboard-mobile.png's active-tab treatment. Uses primary blue rather
// than the screenshot's green, per this pass's explicit brand direction:
// green is reserved for semantic success/income, not nav-active state.
const iconWrapClass = (active: boolean) =>
  cn(
    "flex h-7 w-11 items-center justify-center rounded-full transition-colors",
    active && "bg-primary"
  );

const tabLabelClass = "w-full text-center leading-tight break-words";

/**
 * Fixed mobile bottom tab bar: the same five primary destinations as the
 * desktop nav's center rail (Dashboard, Transactions, Budgets, Reports,
 * Aura), in the same order, laid out as a 5-column grid so every
 * destination keeps an even, predictable width down to 320px. There is no
 * "More" tab — every other destination (Notifications, Profile, Account,
 * Settings) lives in the mobile top bar's avatar menu instead.
 */
export function MobileNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="Bottom"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))] grid-cols-5 items-stretch gap-0.5 border-t border-outline-variant/40 bg-gradient-card px-2 pb-safe shadow-card backdrop-blur-md max-[340px]:gap-0 max-[340px]:px-1 md:hidden"
    >
      {mobileBottomNavRoutes.map((route) => {
        const active = isRouteActive(location.pathname, route.path);
        const Icon = route.icon;
        return (
          <Link key={route.path} to={route.path} aria-current={active ? "page" : undefined} className={tabClass(active)}>
            <span className={iconWrapClass(active)}>
              <Icon
                className={cn("h-5 w-5", active && "text-primary-foreground")}
                aria-hidden="true"
                strokeWidth={active ? 2.5 : 2}
              />
            </span>
            <span className={tabLabelClass}>{route.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
