import { Link, useLocation } from "react-router-dom";
import { Bell, Settings } from "lucide-react";
import { desktopPrimaryRoutes, isRouteActive } from "../../lib/routes";
import { ProfileMenu } from "./ProfileMenu";
import { BrandMark } from "../BrandMark";
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
          <BrandMark tone="solid" size="sm" />
          <span className="hidden sm:inline">Nexali</span>
        </Link>

        {/* Text-only, matching navigation/navbar-desktop.png — the approved
            reference has no icons in the center desktop nav (icons are a
            mobile-nav convention there). Tighter horizontal padding at md
            (tablet) than lg (desktop/laptop) is the tablet adaptation. */}
        <div className="flex h-full min-w-0 flex-1 items-stretch justify-center gap-0.5 lg:gap-1">
          {desktopPrimaryRoutes.map((route) => {
            const active = isRouteActive(location.pathname, route.path);
            return (
              <Link
                key={route.path}
                to={route.path}
                aria-current={active ? "page" : undefined}
                aria-label={route.label}
                className={cn(
                  "flex items-center whitespace-nowrap border-b-2 px-2 text-sm font-medium transition-colors lg:px-4",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground/80 hover:text-foreground"
                )}
              >
                {route.label}
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
