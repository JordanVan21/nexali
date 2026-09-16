import type { ReactNode } from "react";
import { ProfileAvatar } from "../ProfileAvatar";
import { cn } from "../../lib/utils";
import type { NexaliUserPreview } from "../../lib/friends";

/**
 * The standard Nexali user row, used EVERYWHERE another user is displayed
 * in the Friends feature (search results, the friends list, the friend
 * request notification card) -- full name as the primary text, email
 * smaller/lower-emphasis immediately underneath (when shown), avatar (or
 * initials fallback, via the existing ProfileAvatar component) on the
 * left. Never shows email as the title or a bare avatar with no name, per
 * this Part's explicit display standard.
 *
 * `showEmail` makes email visibility an explicit, per-call-site decision
 * rather than an assumption baked into the component -- accepted friends
 * always pass `true` (the default); search results/incoming requests pass
 * it based on `isExactEmailMatch()`/the row's context (see Friends.tsx,
 * FriendRequestNotificationCard.tsx). When false, the email line is
 * omitted entirely (not rendered blank/hidden), so the row naturally
 * collapses to one line of identity text instead of leaving a gap.
 */
export function UserRow({
  user,
  action,
  showEmail = true,
  className,
}: {
  user: NexaliUserPreview;
  /** Right-side content -- a send-request button, a status label, or an overflow menu, depending on the caller's context. */
  action?: ReactNode;
  /** Whether to render the email line beneath the name. Defaults to true (the accepted-friends case); callers showing a non-friend must pass an explicit, privacy-aware value. */
  showEmail?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <ProfileAvatar name={user.fullName} email={user.email} imageUrl={user.avatarUrl} className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{user.fullName}</p>
        {showEmail && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center">{action}</div>}
    </div>
  );
}
