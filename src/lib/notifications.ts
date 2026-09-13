import type { LucideIcon } from "lucide-react";

export type NotificationType = "financial" | "security" | "system" | "assistant";

export type NotificationAction = {
  label: string;
  href: string;
};

export type NotificationDay = "today" | "yesterday" | "earlier";

/**
 * Frontend-only type for future notification wiring -- no notifications
 * table/RPC/Edge Function exists yet. Unlike Lovable's mock data, `day` and
 * the display timestamp aren't stored fields; they're derived from a real
 * ISO `createdAt` so they can never drift out of sync (see notificationDay
 * and formatNotificationTimestamp below).
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
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  financial: "Financial",
  security: "Security",
  system: "System",
  assistant: "Assistant",
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
