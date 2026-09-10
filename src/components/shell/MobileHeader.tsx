import { Link, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import { MobileMenu } from "./MobileMenu";
import { findRouteByPath } from "../../lib/routes";
import { useAvatar } from "../../features/profiles/useAvatar";
import { useUserInfo } from "../../shared/useUserId";
import blankProfile from "../../assets/blank_profile_pic.jpg";

/**
 * Compact header shown on every authenticated mobile page (below md).
 * Hamburger on the left, current page title centered, notifications and
 * profile avatar on the right. dashboard-mobile.png is the visual
 * reference for spacing and density.
 */
export function MobileHeader() {
  const location = useLocation();
  const { userId } = useUserInfo();
  const { data: avatarUrl } = useAvatar(userId);

  const title = findRouteByPath(location.pathname)?.label ?? "Nexali";

  return (
    <header
      className="sticky top-0 z-40 flex h-[var(--mobile-header-height)] items-center justify-between border-b border-primary/10 bg-gradient-card px-3 shadow-card backdrop-blur-md pt-[env(safe-area-inset-top)] md:hidden"
    >
      <div className="flex flex-1 items-center">
        <MobileMenu />
      </div>

      {/*
        Not a heading: each page's own body owns the single <h1> for the
        page (desktop has no title text in AppNav, so the page body must
        always provide it). This is a visual wayfinding label only.
      */}
      <span className="flex-1 truncate text-center text-base font-semibold text-foreground">
        {title}
      </span>

      <div className="flex flex-1 items-center justify-end gap-1">
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Link
          to="/profile"
          aria-label="Profile"
          className="flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <img
            src={avatarUrl || blankProfile}
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-2 ring-border"
          />
        </Link>
      </div>
    </header>
  );
}
