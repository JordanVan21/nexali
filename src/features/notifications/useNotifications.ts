import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "../querykeys";
import {
  dismissNotification,
  getNotificationPreferences,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationFilter,
} from "../../lib/notificationsData";

export function useNotificationsFeed(userId: string | undefined, filter: NotificationFilter) {
  return useQuery({
    queryKey: userId ? qk.notifications(userId, filter) : ["notifications", "disabled"],
    queryFn: () => listNotifications(userId!, filter),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useUnreadNotificationCount(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? qk.notificationsUnreadCount(userId) : ["notificationsUnreadCount", "disabled"],
    queryFn: () => getUnreadNotificationCount(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** Every mutation below invalidates both the feed (every filter tab) and the unread count together, so the two never fall out of sync. */
function useInvalidateNotifications(userId: string | undefined) {
  const qc = useQueryClient();
  return async () => {
    if (!userId) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.notificationsRoot(userId) }),
      qc.invalidateQueries({ queryKey: qk.notificationsUnreadCount(userId) }),
    ]);
  };
}

export function useMarkNotificationRead(userId: string | undefined) {
  const invalidate = useInvalidateNotifications(userId);
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(userId!, id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead(userId: string | undefined) {
  const invalidate = useInvalidateNotifications(userId);
  return useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: invalidate,
  });
}

export function useDismissNotification(userId: string | undefined) {
  const invalidate = useInvalidateNotifications(userId);
  return useMutation({
    mutationFn: (id: string) => dismissNotification(userId!, id),
    onSuccess: invalidate,
  });
}

export function useNotificationPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? qk.notificationPreferences(userId) : ["notificationPreferences", "disabled"],
    queryFn: () => getNotificationPreferences(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/**
 * There is deliberately no useUpdateNotificationPreferences hook here --
 * Settings (the only page that edits preferences) persists them through
 * the atomic update_user_settings RPC (src/features/settings/useUpdateUserSettings.ts)
 * alongside profiles' timezone/currency/date_format/number_format, in one
 * PostgreSQL transaction. A separate, independent notification_preferences
 * mutation would reintroduce the exact non-atomic partial-save bug that
 * RPC was built to fix.
 */
