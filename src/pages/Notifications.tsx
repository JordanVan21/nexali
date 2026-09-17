import { useMemo, useState } from "react";
import { BellOff, CheckCheck } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { NotificationItem } from "../components/notifications/NotificationItem";
import { NotificationsSkeleton } from "../components/notifications/NotificationsSkeleton";
import { FriendRequestNotificationCard } from "../components/friends/FriendRequestNotificationCard";
import { cn, getErrorMessage } from "../lib/utils";
import { notificationDay, notificationTypeLabels, type NotificationDay, type NotificationItemData } from "../lib/notifications";
import type { NotificationFilter } from "../lib/notificationsData";
import { useUserInfo } from "../shared/useUserId";
import {
  useDismissNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsFeed,
  useUnreadNotificationCount,
} from "../features/notifications/useNotifications";
import { useAcceptFriendRequest, useDeclineFriendRequest, useListIncomingFriendRequests } from "../features/friends/useFriendsQueries";
import { useAcceptSplitExpense, useDeclineSplitExpense } from "../features/splitExpenses/useSubmitSplitExpense";

type FilterKey = NotificationFilter;

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "financial", label: notificationTypeLabels.financial },
  { key: "security", label: notificationTypeLabels.security },
  { key: "system", label: notificationTypeLabels.system },
  { key: "assistant", label: notificationTypeLabels.assistant },
];

const DAY_LABELS: Record<NotificationDay, string> = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
};

const ORDERED_DAYS: NotificationDay[] = ["today", "yesterday", "earlier"];

/**
 * Backend Part 7: real, owner-scoped notification feed
 * (src/lib/notificationsData.ts / useNotifications.ts) replaces the
 * previous permanently-empty useState seed. Visual structure (filter
 * tabs, day-grouping, empty-state copy) is unchanged from the pre-backend
 * version -- only the data source and loading/error states are new.
 */
export default function Notifications() {
  const { userId } = useUserInfo();
  const [filter, setFilter] = useState<FilterKey>("all");

  const feed = useNotificationsFeed(userId, filter);
  const unreadCountQuery = useUnreadNotificationCount(userId);
  const markReadMutation = useMarkNotificationRead(userId);
  const dismissMutation = useDismissNotification(userId);
  const markAllMutation = useMarkAllNotificationsRead(userId);

  // Backend Part 8: cross-referenced against friend_request-typed
  // notification rows below to render them as an actionable
  // FriendRequestNotificationCard (sender full name + Accept/Decline) --
  // never the sender's email, matching the same rule everywhere else in
  // Friends. Reused rather than duplicated: any visible (non-dismissed)
  // friend_request notification is, by construction, still pending (both
  // accept_friend_request()/decline_friend_request() dismiss their
  // notification atomically), so this list always has a matching entry
  // for it.
  const incomingRequestsQuery = useListIncomingFriendRequests(userId);
  const acceptRequest = useAcceptFriendRequest(userId);
  const declineRequest = useDeclineFriendRequest(userId);
  const incomingRequestsById = useMemo(
    () => new Map((incomingRequestsQuery.data ?? []).map((r) => [r.requestId, r])),
    [incomingRequestsQuery.data]
  );

  // Split Expenses backend: unlike friend_request (a dedicated card, since
  // it needs the sender's name/avatar from a separate cross-referenced
  // list), a split_expense notification's own description already says
  // everything needed ("X added you to a split expense. Your share is
  // $Y.") -- so this reuses the generic NotificationItem inlineActions
  // mechanism directly, with no separate card component. accept_split_expense()/
  // decline_split_expense() both atomically dismiss their own notification,
  // so any split_expense notification still visible (non-dismissed) here
  // is, by construction, still pending -- same reasoning as the
  // friend_request card.
  const acceptSplit = useAcceptSplitExpense(userId);
  const declineSplit = useDeclineSplitExpense(userId);

  const unreadCount = unreadCountQuery.data ?? 0;

  const notifications = useMemo(() => feed.data ?? [], [feed.data]);
  const grouped = useMemo(() => {
    const groups: Record<NotificationDay, NotificationItemData[]> = { today: [], yesterday: [], earlier: [] };
    for (const n of notifications) groups[notificationDay(n.createdAt)].push(n);
    return groups;
  }, [notifications]);

  const markRead = (id: string) => markReadMutation.mutate(id);
  const dismiss = (id: string) => dismissMutation.mutate(id);
  const markAllRead = () => markAllMutation.mutate();

  const hasAny = notifications.length > 0;

  return (
    <PageContainer>
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[36px] lg:text-[44px] xl:text-[48px]">
              Notifications
            </h1>
            <p className="mt-1 text-[15px] text-muted-foreground sm:text-base lg:text-lg xl:text-xl">
              {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
            </p>
          </div>
          <Button
            type="button"
            variant="surface"
            size="control"
            onClick={markAllRead}
            disabled={unreadCount === 0 || markAllMutation.isPending}
            className="w-full md:w-auto"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all as read
          </Button>
        </div>

        <div
          role="tablist"
          aria-label="Filter notifications"
          className="mb-4 mt-6 flex items-center gap-1 overflow-x-auto rounded-xl bg-surface-low p-1 md:mb-6"
        >
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-surface-high text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {feed.isLoading ? (
          <NotificationsSkeleton />
        ) : feed.isError ? (
          <ErrorState
            title="Couldn't load your notifications"
            message={getErrorMessage(feed.error, "Please check your connection and try again.")}
            onRetry={() => feed.refetch()}
          />
        ) : !hasAny ? (
          <div className="nexali-panel rounded-xl">
            <EmptyState
              icon={BellOff}
              title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
              description={
                filter === "unread"
                  ? "You have no unread notifications right now."
                  : "There's nothing here yet. Budget alerts, security events and Aura insights will show up here as they happen."
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {ORDERED_DAYS.map((day) =>
              grouped[day].length > 0 ? (
                <section key={day} aria-label={DAY_LABELS[day]}>
                  <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {DAY_LABELS[day]}
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {grouped[day].map((n) => {
                      const request = n.type === "friend_request" && n.friendRequestId ? incomingRequestsById.get(n.friendRequestId) : undefined;
                      if (request) {
                        return (
                          <FriendRequestNotificationCard
                            key={n.id}
                            user={{ id: request.senderId, fullName: request.senderFullName, email: null, avatarUrl: request.senderAvatarUrl, status: "incoming_pending" }}
                            isPending={
                              (acceptRequest.isPending && acceptRequest.variables === request.requestId) ||
                              (declineRequest.isPending && declineRequest.variables === request.requestId)
                            }
                            onAccept={() => void acceptRequest.mutate(request.requestId)}
                            onDecline={() => void declineRequest.mutate(request.requestId)}
                          />
                        );
                      }
                      if (n.type === "split_expense" && n.splitExpenseId) {
                        const splitId = n.splitExpenseId;
                        const pending =
                          (acceptSplit.isPending && acceptSplit.variables === splitId) ||
                          (declineSplit.isPending && declineSplit.variables === splitId);
                        return (
                          <NotificationItem
                            key={n.id}
                            notification={{
                              ...n,
                              inlineActions: [
                                { label: "Decline", variant: "surface", disabled: pending, onClick: () => void declineSplit.mutate(splitId) },
                                { label: "Accept", variant: "hero", disabled: pending, onClick: () => void acceptSplit.mutate(splitId) },
                              ],
                            }}
                            onMarkRead={markRead}
                            onDismiss={dismiss}
                          />
                        );
                      }
                      return <NotificationItem key={n.id} notification={n} onMarkRead={markRead} onDismiss={dismiss} />;
                    })}
                  </ul>
                </section>
              ) : null
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
