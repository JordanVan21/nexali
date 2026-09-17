import { supabase } from "../supabaseClient";
import type { Database } from "../types/database.types";
import type { NotificationItemData, NotificationType } from "./notifications";
import { notificationTypeIcon } from "./notifications";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type PreferencesRow = Database["public"]["Tables"]["notification_preferences"]["Row"];

/**
 * Bounded feed size for v1 -- the real Notifications page has no
 * pagination UI (infinite scroll, "load more", page numbers), so a fixed
 * "latest N non-dismissed" window is the correct match for what the
 * frontend actually renders, not an unbounded fetch. Older notifications
 * beyond this window remain in the database (never deleted) but are not
 * currently reachable from the UI -- a real pagination affordance would be
 * a frontend change, out of scope for this backend-only Part.
 */
const FEED_LIMIT = 50;

export type NotificationFilter = "all" | "unread" | NotificationType;

function toItemData(row: NotificationRow): NotificationItemData {
  return {
    id: row.id,
    type: row.type as NotificationType,
    icon: notificationTypeIcon[row.type as NotificationType],
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    read: row.read_at !== null,
    primaryAction:
      row.action_href && row.action_label ? { href: row.action_href, label: row.action_label } : undefined,
    secondaryAction:
      row.secondary_action_href && row.secondary_action_label
        ? { href: row.secondary_action_href, label: row.secondary_action_label }
        : undefined,
    // Backend Part 8 / Split Expenses backend. inlineActions (real
    // Accept/Decline handlers) are wired up by the Notifications page
    // itself, not here -- this data-access layer only carries the raw
    // reference ids through.
    friendRequestId: row.friend_request_id,
    splitExpenseId: row.split_expense_id,
  };
}

/**
 * The real, owner-scoped notification feed for `userId`, newest first,
 * excluding dismissed rows. `filter` is applied server-side (not fetched
 * unfiltered and sliced in the browser) so the response stays bounded
 * regardless of which tab is active.
 */
export async function listNotifications(userId: string, filter: NotificationFilter): Promise<NotificationItemData[]> {
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);

  if (filter === "unread") {
    query = query.is("read_at", null);
  } else if (filter === "system") {
    // Backend Part 8 / Split Expenses backend: friend_request and
    // split_expense notifications both fold into the existing "System"
    // tab rather than getting their own new tab (no visual redesign of the
    // filter row) -- see docs/BACKEND_AUDIT_REPORT.md's Friends/Split
    // Expenses entries for the exact rationale.
    query = query.in("type", ["system", "friend_request", "split_expense"]);
  } else if (filter !== "all") {
    query = query.eq("type", filter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toItemData);
}

/** Real count of this user's non-dismissed, unread notifications -- a count query, never a fetch-all-then-count. */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

/** Marks every currently unread, non-dismissed notification for `userId` read in one request. */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .is("read_at", null);

  if (error) throw error;
}

export async function dismissNotification(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export type NotificationPreferences = Pick<
  PreferencesRow,
  "budget_approaching" | "budget_exceeded" | "monthly_summary" | "account_security"
>;

/**
 * handle_new_user() (new signups) and a one-time migration backfill
 * (existing users) both guarantee a preferences row already exists for
 * every real user, so this should always find one -- `maybeSingle` plus
 * the DEFAULT_PREFERENCES fallback below is defense-in-depth, not the
 * expected path.
 */
const DEFAULT_PREFERENCES: NotificationPreferences = {
  budget_approaching: true,
  budget_exceeded: true,
  monthly_summary: true,
  account_security: true,
};

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("budget_approaching, budget_exceeded, monthly_summary, account_security")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? DEFAULT_PREFERENCES;
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferences>
): Promise<void> {
  // Upsert (not a plain update) so this stays correct even in the
  // defense-in-depth case where a row is somehow missing -- the owner-scoped
  // INSERT policy on notification_preferences exists for exactly this path.
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });

  if (error) throw error;
}
