import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BellOff, CheckCheck } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { NotificationsSkeleton } from "@/components/notifications/NotificationsSkeleton";
import { mockNotifications, notificationTypeLabels, type NotificationItemData, type NotificationType } from "@/mock/notifications";
import { mockUser, mockUnreadNotifications } from "@/mock/profile";
import { cn } from "@/lib/utils";

const title = "Notifications — Nexali";
const description = "Stay on top of budget alerts, security events and Aura insights in one feed.";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

type FilterKey = "all" | "unread" | NotificationType;

const filterTabs: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "financial", label: notificationTypeLabels.financial },
  { key: "security", label: notificationTypeLabels.security },
  { key: "system", label: notificationTypeLabels.system },
  { key: "assistant", label: notificationTypeLabels.assistant },
];

const dayLabels: Record<NotificationItemData["day"], string> = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
};

function NotificationsPage() {
  // Simulated loading state to showcase the skeleton — local demo only.
  const [loading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItemData[]>(mockNotifications);
  const [filter, setFilter] = useState<FilterKey>("all");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const grouped = useMemo(() => {
    const groups: Record<NotificationItemData["day"], NotificationItemData[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const n of filtered) groups[n.day].push(n);
    return groups;
  }, [filtered]);

  const markRead = (id: string) =>
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const dismiss = (id: string) => setNotifications((list) => list.filter((n) => n.id !== id));

  const markAllRead = () => setNotifications((list) => list.map((n) => ({ ...n, read: true })));

  const orderedDays: NotificationItemData["day"][] = ["today", "yesterday", "earlier"];
  const hasAny = filtered.length > 0;

  return (
    <AppShell activeKey="notifications" userName={mockUser.name} notificationCount={mockUnreadNotifications}>
      <PageContainer className="max-w-[820px]">
        <PageHeader
          title="Notifications"
          description={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
          actions={
            <Button
              variant="surface"
              size="control"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="max-md:w-full"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </Button>
          }
        />

        <div
          role="tablist"
          aria-label="Filter notifications"
          className="mb-4 flex items-center gap-1 overflow-x-auto rounded-xl bg-surface-low p-1 scroll-slim md:mb-6"
        >
          {filterTabs.map((tab) => {
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
                  active
                    ? "bg-surface-high text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <NotificationsSkeleton />
        ) : !hasAny ? (
          <div className="nexali-panel rounded-xl">
            <EmptyState
              icon={BellOff}
              title={filter === "unread" ? "You're all caught up" : "No notifications"}
              description={
                filter === "unread"
                  ? "You have no unread notifications right now."
                  : "There's nothing here yet. New activity will show up as it happens."
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {orderedDays.map((day) =>
              grouped[day].length > 0 ? (
                <section key={day} aria-label={dayLabels[day]}>
                  <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {dayLabels[day]}
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {grouped[day].map((n) => (
                      <NotificationItem key={n.id} notification={n} onMarkRead={markRead} onDismiss={dismiss} />
                    ))}
                  </ul>
                </section>
              ) : null,
            )}
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}
