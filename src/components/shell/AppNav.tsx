import { Link, useLocation } from "react-router-dom";
import { Bell, Settings } from "lucide-react";
import { desktopPrimaryRoutes, isRouteActive } from "../../lib/routes";
import { ProfileMenu } from "./ProfileMenu";
import { BrandMark } from "../BrandMark";
import { cn } from "../../lib/utils";
import { CONTENT_MAX_WIDTH_CLASS, CONTENT_PADDING_CLASS } from "./containerWidth";

const iconLinkClass =
  "flex h-9 w-9 lg:h-10 lg:w-10 xl:h-11 xl:w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
      className="sticky top-0 z-40 hidden h-[var(--desktop-nav-height)] border-b border-outline-variant/40 bg-gradient-card shadow-card backdrop-blur-md md:block xl:h-[var(--desktop-nav-height-xl)] 2xl:h-[var(--desktop-nav-height-2xl)]"
    >
      <div
        className={cn(
          "mx-auto flex h-full items-center justify-between gap-4",
          CONTENT_MAX_WIDTH_CLASS,
          CONTENT_PADDING_CLASS
        )}
      >
        <Link
          to="/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-lg text-lg font-bold text-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background xl:text-xl"
        >
          {/* Box/icon grow modestly at xl/2xl on top of the existing "md"
              size — everything below xl (including the approved ~1174px
              reference) keeps the current 32px/20px mark untouched. */}
          <BrandMark
            tone="solid"
            size="md"
            className="xl:h-9 xl:w-9 2xl:h-10 2xl:w-10 xl:[&_svg]:h-6 xl:[&_svg]:w-6 2xl:[&_svg]:h-7 2xl:[&_svg]:w-7"
          />
          {/* Hidden through the md (tablet) range so the five center-nav
              labels have room; reappears at lg once there's space again. */}
          <span className="hidden lg:inline">Nexali</span>
        </Link>

        {/* Text-only, matching navigation/navbar-desktop.png — the approved
            reference has no icons in the center desktop nav (icons are a
            mobile-nav convention there). At md (tablet) each item shows a
            shorter label (falling back to the full label when none is
            defined); lg (desktop/laptop) shows the full label. */}
        <div className="flex h-full min-w-0 flex-1 items-stretch justify-center gap-1 lg:gap-3 xl:gap-6">
          {desktopPrimaryRoutes.map((route) => {
            const active = isRouteActive(location.pathname, route.path);
            return (
              <Link
                key={route.path}
                to={route.path}
                aria-current={active ? "page" : undefined}
                aria-label={route.label}
                className={cn(
                  "flex items-center whitespace-nowrap border-b-2 px-2 text-sm font-medium transition-colors lg:px-4 lg:text-base xl:px-5 xl:text-lg",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground/80 hover:text-foreground"
                )}
              >
                <span className="lg:hidden">{route.shortLabel ?? route.label}</span>
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
                ? "bg-surface-high text-primary"
                : "text-foreground/80 hover:bg-surface-high hover:text-foreground"
            )}
          >
            <Bell className="h-[18px] w-[18px] lg:h-5 lg:w-5 xl:h-[22px] xl:w-[22px] 2xl:h-6 2xl:w-6" aria-hidden="true" />
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            aria-current={settingsActive ? "page" : undefined}
            title="Settings"
            className={cn(
              iconLinkClass,
              settingsActive
                ? "bg-surface-high text-primary"
                : "text-foreground/80 hover:bg-surface-high hover:text-foreground"
            )}
          >
            <Settings className="h-[18px] w-[18px] lg:h-5 lg:w-5 xl:h-[22px] xl:w-[22px] 2xl:h-6 2xl:w-6" aria-hidden="true" />
          </Link>
          <ProfileMenu />
        </div>
      </div>
    </nav>
  );
}
