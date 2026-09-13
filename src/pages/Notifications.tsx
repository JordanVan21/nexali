import { useMemo, useState } from "react";
import { BellOff, CheckCheck } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/states/EmptyState";
import { NotificationItem } from "../components/notifications/NotificationItem";
import { cn } from "../lib/utils";
import { notificationDay, notificationTypeLabels, type NotificationDay, type NotificationItemData, type NotificationType } from "../lib/notifications";

type FilterKey = "all" | "unread" | NotificationType;

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
 * No notifications table/RPC/Edge Function exists yet. `notifications`
 * starts as a real empty array -- never Lovable's mock feed -- so the page
 * always shows a truthful empty state today. The filter tabs, day-grouping,
 * mark-read/dismiss/mark-all-read handlers and unread count are all real,
 * just permanently inert against zero data, so a future real query can
 * replace the useState seed without another visual redesign.
 */
export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const grouped = useMemo(() => {
    const groups: Record<NotificationDay, NotificationItemData[]> = { today: [], yesterday: [], earlier: [] };
    for (const n of filtered) groups[notificationDay(n.createdAt)].push(n);
    return groups;
  }, [filtered]);

  const markRead = (id: string) =>
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const dismiss = (id: string) => setNotifications((list) => list.filter((n) => n.id !== id));
  const markAllRead = () => setNotifications((list) => list.map((n) => ({ ...n, read: true })));

  const hasAny = filtered.length > 0;

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
            disabled={unreadCount === 0}
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

        {!hasAny ? (
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
                    {grouped[day].map((n) => (
                      <NotificationItem key={n.id} notification={n} onMarkRead={markRead} onDismiss={dismiss} />
                    ))}
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
