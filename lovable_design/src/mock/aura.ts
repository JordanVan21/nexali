/**
 * Mock data only — replace with real Nexali hooks on integration.
 * Presentation components receive these shapes through props.
 */

export type AuraChartLegendItem = {
  label: string;
  percent: number;
  color: "primary" | "success" | "warning" | "destructive";
};

export type AuraMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  chart?: {
    title: string;
    asOf: string;
    highlightLabel: string;
    highlightValue: string;
    legend: AuraChartLegendItem[];
  };
  followUp?: string;
};

export type AuraConversation = {
  id: string;
  title: string;
  timeLabel: string;
};

export const mockConversations: AuraConversation[] = [
  { id: "c-1", title: "Q3 Spending Review", timeLabel: "2 hours ago" },
  { id: "c-2", title: "Tax Optimization Strategies", timeLabel: "Yesterday" },
  { id: "c-3", title: "Subscription Audit", timeLabel: "Oct 24" },
];

export const mockActiveConversationId = "c-1";

export const mockSuggestedQuestions: string[] = [
  "Where did I overspend this month?",
  "Show my savings rate trend",
  "Find recurring subscriptions",
];

export const mockInitialMessages: AuraMessage[] = [
  {
    id: "m-1",
    role: "user",
    text: "Can you show me my spending breakdown compared to last month? I'm worried I'm overspending on dining out.",
    timestamp: "10:42 AM",
  },
  {
    id: "m-2",
    role: "assistant",
    text: "Of course. Looking across your 3 connected accounts, dining is up 18.4% versus last month and now makes up the largest share of your discretionary spending.",
    timestamp: "10:42 AM",
    chart: {
      title: "Discretionary Spending Mix",
      asOf: "As of Oct 27, 2023",
      highlightLabel: "Dining",
      highlightValue: "38%",
      legend: [
        { label: "Dining", percent: 38, color: "primary" },
        { label: "Entertainment", percent: 22, color: "success" },
        { label: "Shopping", percent: 19, color: "warning" },
      ],
    },
    followUp: "Want me to suggest a weekly dining budget to bring this back in line?",
  },
];

/** Canned assistant replies used for the local-only conversation loop. */
export const mockCannedReplies: AuraMessage["text"][] = [
  "Based on your last 90 days of activity, your average daily burn is $184.20 — about 12% higher than your 6-month average.",
  "Your net cash flow has stayed positive for 8 consecutive months, averaging a $2,410.50 monthly surplus.",
  "I found 4 recurring subscriptions totaling $86.97/month. Two haven't been used in over 60 days — want a cancellation checklist?",
  "Your savings rate is currently 34.1%, above your 25% target. Nice work staying disciplined this quarter.",
  "Housing remains your largest fixed cost at 46% of expenses. Everything else is trending within your budget bands.",
];

export const mockAuraUser = {
  firstName: "Jordan",
};
