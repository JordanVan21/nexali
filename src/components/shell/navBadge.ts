/** Above this, a nav badge shows "99+" rather than growing without bound. */
export const BADGE_CAP = 99;

export function formatBadgeCount(count: number): string {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
}

/** "Notifications" (zero/unknown) or "Notifications, N unread". */
export function notificationsAriaLabel(unreadCount: number): string {
  return unreadCount > 0 ? `Notifications, ${formatBadgeCount(unreadCount)} unread` : "Notifications";
}

/** "Friends" (zero/unknown) or "Friends, N pending request(s)". */
export function friendsAriaLabel(pendingCount: number): string {
  if (pendingCount <= 0) return "Friends";
  return `Friends, ${formatBadgeCount(pendingCount)} pending request${pendingCount === 1 ? "" : "s"}`;
}
