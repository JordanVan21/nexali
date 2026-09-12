/** Mock notifications feed — local-state only, replace with real Nexali hooks on integration. */

import type { LucideIcon } from "lucide-react";
import {
  TrendingUp,
  ShieldAlert,
  Banknote,
  DatabaseZap,
  KeyRound,
  BellRing,
  Sparkles,
} from "lucide-react";

export type NotificationType = "financial" | "security" | "system" | "assistant";

export type NotificationItemData = {
  id: string;
  type: NotificationType;
  icon: LucideIcon;
  title: string;
  description: string;
  timestamp: string;
  /** ISO-ish bucket used for day grouping in this mock. */
  day: "today" | "yesterday" | "earlier";
  read: boolean;
  primaryAction?: string;
  secondaryAction?: string;
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  financial: "Financial",
  security: "Security",
  system: "System",
  assistant: "Assistant",
};

export const mockNotifications: NotificationItemData[] = [
  {
    id: "n1",
    type: "financial",
    icon: TrendingUp,
    title: "Budget threshold exceeded",
    description:
      "Dining & Takeout has reached 92% of its monthly allocation ($552 of $600).",
    timestamp: "3 mins ago",
    day: "today",
    read: false,
    primaryAction: "Review Budget",
    secondaryAction: "Adjust Limit",
  },
  {
    id: "n2",
    type: "security",
    icon: ShieldAlert,
    title: "New device sign-in request",
    description:
      "A new device attempted to sign in from Zurich, Switzerland via Safari 17.4.",
    timestamp: "18 mins ago",
    day: "today",
    read: false,
    primaryAction: "Approve Device",
    secondaryAction: "Block Session",
  },
  {
    id: "n3",
    type: "financial",
    icon: Banknote,
    title: "Direct deposit received ($3,420.00)",
    description: "Payroll deposit cleared from Nexali Payroll Inc.",
    timestamp: "1 hour ago",
    day: "today",
    read: false,
    primaryAction: "View Transaction",
  },
  {
    id: "n4",
    type: "system",
    icon: DatabaseZap,
    title: "Monthly account sync complete",
    description: "All connected accounts were verified with zero sync errors.",
    timestamp: "3 hours ago",
    day: "today",
    read: false,
    primaryAction: "View Sync Log",
  },
  {
    id: "n5",
    type: "security",
    icon: KeyRound,
    title: "Password changed successfully",
    description: "Your account password was updated from a trusted device.",
    timestamp: "Yesterday, 14:15",
    day: "yesterday",
    read: true,
  },
  {
    id: "n6",
    type: "assistant",
    icon: Sparkles,
    title: "Aura found a savings opportunity",
    description:
      "Switching your streaming bundle could save roughly $14/month based on recent usage.",
    timestamp: "Yesterday, 09:02",
    day: "yesterday",
    read: true,
    primaryAction: "Ask Aura",
  },
  {
    id: "n7",
    type: "financial",
    icon: TrendingUp,
    title: "Weekly spending summary ready",
    description: "You spent $412 this week, 8% less than your weekly average.",
    timestamp: "3 days ago",
    day: "earlier",
    read: true,
  },
  {
    id: "n8",
    type: "system",
    icon: BellRing,
    title: "New feature: Recurring bill detection",
    description: "Nexali can now automatically flag recurring subscriptions in Transactions.",
    timestamp: "5 days ago",
    day: "earlier",
    read: true,
  },
];
