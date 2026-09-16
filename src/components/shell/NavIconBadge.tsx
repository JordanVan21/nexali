import { cn } from "../../lib/utils";
import { formatBadgeCount } from "./navBadge";

/**
 * Small numeric overlay for a nav icon (Notifications unread count, Friends
 * incoming-request count) -- absolutely positioned near the icon's
 * upper-right corner via the caller adding `relative` to the icon's own
 * wrapper, so it never shifts surrounding nav items. Renders nothing for
 * count <= 0 (covers both "genuinely zero" and "not loaded yet" -- callers
 * pass 0 for both, see AppNav.tsx/MobileHeader.tsx). `aria-hidden` because
 * the count is already communicated through the icon link's own
 * `aria-label` (see navBadge.ts's notificationsAriaLabel/friendsAriaLabel)
 * -- the badge is a visual reinforcement, never the only accessible
 * information.
 */
export function NavIconBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background",
        className
      )}
    >
      {formatBadgeCount(count)}
    </span>
  );
}
