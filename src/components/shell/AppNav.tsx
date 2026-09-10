import { Link, useLocation } from "react-router-dom";
import { Landmark, Bell, Settings } from "lucide-react";
import { desktopPrimaryRoutes, isRouteActive } from "../../lib/routes";
import { ProfileMenu } from "./ProfileMenu";
import { cn } from "../../lib/utils";

const iconLinkClass =
  "flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Canonical authenticated desktop and tablet navigation bar. Rendered
 * alongside MobileHeader/MobileNav (hidden below md via CSS) rather than
 * behind a JS isMobile check, so there is no first-render flash of the
 * wrong layout.
 *
 * At md (tablet) width, center nav labels collapse to icon-only with an
 * accessible name, to avoid wrapping five labelled items plus the logo and
 * right-side controls. Full icon+label returns at lg (small laptop) width.
 */
export function AppNav() {
  const location = useLocation();

  const notificationsActive = isRouteActive(location.pathname, "/notifications");
  const settingsActive = isRouteActive(location.pathname, "/settings");

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-40 hidden h-[var(--desktop-nav-height)] border-b border-primary/10 bg-gradient-card shadow-card backdrop-blur-md md:block"
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between gap-4 px-4 lg:px-8">
        <Link
          to="/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-lg text-lg font-bold text-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Landmark className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="hidden sm:inline">Nexali</span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
          {desktopPrimaryRoutes.map((route) => {
            const active = isRouteActive(location.pathname, route.path);
            const Icon = route.icon;
            return (
              <Link
                key={route.path}
                to={route.path}
                aria-current={active ? "page" : undefined}
                aria-label={route.label}
                title={route.label}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:px-4",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-foreground/80 hover:bg-accent/30 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline">{route.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/notifications"
            aria-label="Notifications"
            aria-current={notificationsActive ? "page" : undefined}
            title="Notifications"
            className={cn(
              iconLinkClass,
              notificationsActive
                ? "bg-primary/15 text-primary"
                : "text-foreground/80 hover:bg-accent/30 hover:text-foreground"
            )}
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            aria-current={settingsActive ? "page" : undefined}
            title="Settings"
            className={cn(
              iconLinkClass,
              settingsActive
                ? "bg-primary/15 text-primary"
                : "text-foreground/80 hover:bg-accent/30 hover:text-foreground"
            )}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
          <ProfileMenu />
        </div>
      </div>
    </nav>
  );
}
