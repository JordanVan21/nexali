import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Link, useLocation } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { mobileBottomNavRoutes, isRouteActive, isSecondaryRouteActive } from "../../lib/routes";
import { MobileMenu } from "./MobileMenu";
import { cn } from "../../lib/utils";

const tabClass = (active: boolean) =>
  cn(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 text-xs font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
  );

type MoreTabButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean };

const MoreTabButton = forwardRef<HTMLButtonElement, MoreTabButtonProps>(function MoreTabButton(
  { active, ...props },
  ref
) {
  return (
    <button ref={ref} type="button" aria-label="More" className={tabClass(active)} {...props}>
      <MoreHorizontal className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.5 : 2} />
      <span>More</span>
    </button>
  );
});

/**
 * Fixed mobile bottom tab bar: Dashboard, Transactions, Budgets, Aura,
 * More. The four routed tabs activate on an exact path match; More
 * activates for every page not on the bar (Reports, Notifications,
 * Profile, Account, Settings) and opens the shared mobile menu.
 */
export function MobileNav() {
  const location = useLocation();
  const moreActive = isSecondaryRouteActive(location.pathname);

  return (
    <nav
      aria-label="Bottom"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))] items-stretch gap-1 border-t border-primary/10 bg-gradient-card px-2 pb-[env(safe-area-inset-bottom)] shadow-card backdrop-blur-md md:hidden"
    >
      {mobileBottomNavRoutes.map((route) => {
        const active = isRouteActive(location.pathname, route.path);
        const Icon = route.icon;
        return (
          <Link key={route.path} to={route.path} aria-current={active ? "page" : undefined} className={tabClass(active)}>
            <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.5 : 2} />
            <span>{route.label}</span>
          </Link>
        );
      })}
      <MobileMenu trigger={<MoreTabButton active={moreActive} />} />
    </nav>
  );
}
