import { Link, useLocation } from "react-router-dom";
import { UsersRound } from "lucide-react";
import { BrandMark } from "../BrandMark";
import { MobileProfileMenu } from "./MobileProfileMenu";
import { isRouteActive } from "../../lib/routes";
import { cn } from "../../lib/utils";
import { NavIconBadge } from "./NavIconBadge";
import { friendsAriaLabel } from "./navBadge";
import { useFriends } from "../../features/friends/useFriends";

/**
 * Compact app-style top bar shown on every authenticated mobile page (below
 * md): brand mark on the left (matching the desktop nav's logo, linking
 * home), Friends icon + profile/account menu on the right. Notifications
 * and Settings are intentionally still not shown here as standalone icons
 * — they live inside the avatar menu on phone widths. Friends is the one
 * deliberate exception (explicit product requirement): it gets its own
 * standalone icon, immediately to the left of the avatar, rather than
 * living inside the dropdown.
 */
export function MobileHeader() {
  const location = useLocation();
  const friendsActive = isRouteActive(location.pathname, "/friends");

  // Shared with the Friends page and AppNav's own badge via FriendsProvider
  // (see AppLayout.tsx) -- FUTURE REPLACEMENT POINT: once a real backend
  // incoming-request count exists, only useFriendsState()'s internals need
  // to change; this line stays the same.
  const { incomingRequests } = useFriends();
  const pendingRequestCount = incomingRequests.length;

  return (
    <header className="sticky top-0 z-40 flex h-[var(--mobile-header-height)] items-center justify-between border-b border-outline-variant/40 bg-background/95 px-3 backdrop-blur-md pt-safe md:hidden">
      <Link
        to="/dashboard"
        aria-label="Nexali home"
        className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <BrandMark tone="solid" size="sm" className="h-7 w-7 [&_svg]:h-4 [&_svg]:w-4" />
        <span className="truncate text-lg font-bold text-foreground">Nexali</span>
      </Link>

      <div className="flex items-center gap-1">
        <Link
          to="/friends"
          aria-label={friendsAriaLabel(pendingRequestCount)}
          aria-current={friendsActive ? "page" : undefined}
          title="Friends"
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            friendsActive ? "bg-surface-high text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <UsersRound className="h-5 w-5" aria-hidden="true" />
          <NavIconBadge count={pendingRequestCount} />
        </Link>
        <MobileProfileMenu />
      </div>
    </header>
  );
}
