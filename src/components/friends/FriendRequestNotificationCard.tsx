import { UserPlus } from "lucide-react";
import { Button } from "../ui/button";
import { UserRow } from "./UserRow";
import type { NexaliUserPreview } from "../../lib/friends";

/**
 * Frontend-only preview of the notification an incoming friend request
 * will eventually become once a real backend exists (Backend Part 7's
 * `notifications` table/producer architecture is untouched -- this is a
 * separate, purely presentational component, not wired into the real
 * Notifications page/query). Deliberately mirrors
 * components/notifications/NotificationItem.tsx's visual language (icon
 * box, title/badge row, unread dot, `<li>` row shape, `size="sm"` action
 * buttons) by hand rather than extending NotificationItem itself --
 * NotificationItem's props are tied to the real, deployed
 * `NotificationItemData`/DB `type` union (financial/security/system/
 * assistant), which this Part is explicitly forbidden from changing.
 * Once a real "friend_request" notification type is designed on the
 * backend, this component's Accept/Decline interaction can move into
 * NotificationItem's own action architecture rather than staying a
 * parallel component.
 *
 * Sender identity uses the shared UserRow component with `showEmail={false}`
 * -- the receiving user did not perform an exact email search for the
 * sender, so their email must not appear here regardless of what the
 * sender's own search visibility looked like when they sent the request
 * (see lib/friends.ts's isExactEmailMatch doc comment: a sender's search
 * query is never carried to the receiver). Accepting the request and
 * becoming friends is what unlocks normal email display, in the Your
 * Friends list.
 */
export function FriendRequestNotificationCard({
  user,
  onAccept,
  onDecline,
  isPending = false,
}: {
  user: NexaliUserPreview;
  onAccept: () => void;
  onDecline: () => void;
  isPending?: boolean;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-transparent bg-surface-low p-4">
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <UserPlus className="h-5 w-5" aria-hidden="true" />
        <span
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface-low"
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Friend Request</span>
          <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Friends
          </span>
        </div>

        <div className="mt-2">
          <UserRow user={user} showEmail={false} />
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">sent you a friend request.</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="surface"
            size="sm"
            onClick={onDecline}
            disabled={isPending}
            aria-label={`Decline friend request from ${user.fullName}`}
          >
            Decline
          </Button>
          <Button
            type="button"
            variant="hero"
            size="sm"
            onClick={onAccept}
            disabled={isPending}
            aria-label={`Accept friend request from ${user.fullName}`}
          >
            Accept
          </Button>
        </div>
      </div>
    </li>
  );
}
