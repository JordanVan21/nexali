import { Info, ShieldAlert, Sparkles, TrendingUp, UserPlus, type LucideIcon } from "lucide-react";

/**
 * 'friend_request' added in Backend Part 8 -- see
 * 20260919000100_friends_notification_integration.sql, which widens the
 * real `notifications.type` CHECK constraint to match. Deliberately NOT
 * added as its own entry in Notifications.tsx's FILTER_TABS (that array is
 * hand-written, not derived from this union, specifically so adding a type
 * here never silently adds a new tab) -- see
 * docs/BACKEND_AUDIT_REPORT.md's Friends entry for the exact filter
 * behavior chosen instead (folded into "System").
 */
export type NotificationType = "financial" | "security" | "system" | "assistant" | "friend_request";

export type NotificationAction = {
  label: string;
  href: string;
};

/**
 * An in-page action that performs a real mutation (e.g. Accept/Decline a
 * friend request) rather than navigating -- added in Backend Part 8
 * because primaryAction/secondaryAction are Link-based and cannot express
 * "call this RPC". Deliberately a separate, additive field rather than a
 * change to the existing Link-based actions, so every non-friend-request
 * notification (and NotificationItem.test.tsx's existing fixtures) is
 * completely unaffected.
 */
export type NotificationInlineAction = {
  label: string;
  onClick: () => void;
  variant?: "hero" | "surface";
  disabled?: boolean;
};

export type NotificationDay = "today" | "yesterday" | "earlier";

/**
 * Frontend type for the real, Supabase-backed Notifications feed (Backend
 * Part 7). `day` and the display timestamp aren't stored fields; they're
 * derived from a real ISO `createdAt` so they can never drift out of sync
 * (see notificationDay and formatNotificationTimestamp below).
 */
export type NotificationItemData = {
  id: string;
  type: NotificationType;
  icon: LucideIcon;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  primaryAction?: NotificationAction;
  secondaryAction?: NotificationAction;
  /** Real onClick-based actions (Backend Part 8: friend-request Accept/Decline). Empty/undefined for every other notification. */
  inlineActions?: NotificationInlineAction[];
  /** For type="friend_request": the real friend_requests row this notification is about (see notifications.friend_request_id). Null/undefined for every other type. */
  friendRequestId?: string | null;
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  financial: "Financial",
  security: "Security",
  system: "System",
  assistant: "Assistant",
  friend_request: "Friends",
};

/**
 * The real `notifications` table (Backend Part 7) stores only a `type`
 * string -- a LucideIcon component reference can't be persisted -- so the
 * data-access layer maps a stored row's `type` through this table to
 * satisfy NotificationItemData's `icon` field. `assistant` uses the same
 * Sparkles icon already used for Aura elsewhere (see AuraEntryCard).
 * `friend_request` uses the same UserPlus icon as
 * components/friends/FriendRequestNotificationCard.tsx, for visual
 * consistency between the two places a friend request can be seen.
 */
export const notificationTypeIcon: Record<NotificationType, LucideIcon> = {
  financial: TrendingUp,
  security: ShieldAlert,
  system: Info,
  assistant: Sparkles,
  friend_request: UserPlus,
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function notificationDay(createdAtISO: string, now: Date = new Date()): NotificationDay {
  const diffDays = Math.round((startOfDay(now) - startOfDay(new Date(createdAtISO))) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  return "earlier";
}

export function formatNotificationTimestamp(createdAtISO: string, now: Date = new Date()): string {
  const created = new Date(createdAtISO);
  const diffMin = Math.round((now.getTime() - created.getTime()) / 60_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24 && notificationDay(createdAtISO, now) === "today") {
    return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  }

  return created.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
