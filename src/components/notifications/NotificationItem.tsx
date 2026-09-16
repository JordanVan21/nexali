import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { notificationTypeLabels, formatNotificationTimestamp, type NotificationItemData } from "../../lib/notifications";

const TYPE_ACCENT: Record<NotificationItemData["type"], string> = {
  financial: "bg-warning/15 text-warning",
  security: "bg-destructive/15 text-destructive",
  system: "bg-primary/15 text-primary",
  assistant: "bg-success/15 text-success",
  friend_request: "bg-primary/15 text-primary",
};

/**
 * Presentational notification row, real-Lovable fidelity. Accepts a typed
 * notification so a future real query can render through it unchanged --
 * production never has data to pass it today (see pages/Notifications.tsx),
 * but component tests exercise it with fixtures.
 */
export function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
}: {
  notification: NotificationItemData;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { id, type, icon: Icon, title, description, createdAt, read, primaryAction, secondaryAction, inlineActions } = notification;

  return (
    <li
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border border-transparent p-4 transition-colors",
        read ? "bg-surface-low/60" : "bg-surface-low hover:bg-surface"
      )}
    >
      <div className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-xl", TYPE_ACCENT[type])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
        {!read && (
          <span
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface-low"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {notificationTypeLabels[type]}
          </span>
          <span className="numeric text-xs text-muted-foreground">{formatNotificationTimestamp(createdAt)}</span>
          {!read && <span className="sr-only">(unread)</span>}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {primaryAction && (
            <Button asChild variant="hero" size="sm">
              <Link to={primaryAction.href}>{primaryAction.label}</Link>
            </Button>
          )}
          {secondaryAction && (
            <Button asChild variant="surface" size="sm">
              <Link to={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          )}
          {inlineActions?.map((action) => (
            <Button
              key={action.label}
              type="button"
              variant={action.variant ?? "surface"}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </Button>
          ))}
          {!read && (
            <button
              type="button"
              onClick={() => onMarkRead(id)}
              className="ml-auto text-xs font-medium text-primary hover:underline sm:ml-0"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label={`Dismiss notification: ${title}`}
        onClick={() => onDismiss(id)}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-70 transition-opacity hover:bg-surface-high hover:text-foreground hover:opacity-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}
