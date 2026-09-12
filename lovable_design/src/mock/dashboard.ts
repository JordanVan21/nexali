/**
 * Mock data only — replace with real Nexali hooks on integration.
 * Presentation components receive these shapes through props.
 */

export type StatTrend = "up" | "down" | "flat";

export type SummaryStat = {
  id: string;
  label: string;
  value: number;
  trend: StatTrend;
  trendLabel: string;
  format: "currency" | "count" | "percent";
};

export type CashflowPoint = {
  month: string;
  income: number;
  expenses: number;
};

export type SpendingSlice = {
  id: string;
  label: string;
  amount: number;
  percent: number;
  tone: "primary" | "success" | "warning" | "destructive" | "neutral";
};

export type ActivityItem = {
  id: string;
  merchant: string;
  category: string;
  date: string; // ISO
  amount: number; // negative expense, positive income
  icon: "cart" | "bank" | "car" | "coffee" | "home" | "bolt" | "plane";
};

export type BudgetSnapshotItem = {
  id: string;
  category: string;
  spent: number;
  limit: number;
  tone: "primary" | "success" | "warning" | "destructive";
};

export const mockSummaryStats: SummaryStat[] = [
  { id: "net-worth", label: "Total Net Worth", value: 128459.32, trend: "up", trendLabel: "+2.4% this month", format: "currency" },
  { id: "cash-flow", label: "Monthly Cash Flow", value: 4203, trend: "up", trendLabel: "+$1,120 vs last month", format: "currency" },
  { id: "remaining-budget", label: "Remaining Budget", value: 2140.5, trend: "flat", trendLabel: "74% of plan left", format: "currency" },
  { id: "warnings", label: "Active Warnings", value: 2, trend: "down", trendLabel: "Dining is over limit", format: "count" },
];

export const mockCashflow: CashflowPoint[] = [
  { month: "Jan", income: 8200, expenses: 6100 },
  { month: "Feb", income: 8400, expenses: 6600 },
  { month: "Mar", income: 8100, expenses: 6350 },
  { month: "Apr", income: 9200, expenses: 7000 },
  { month: "May", income: 9600, expenses: 7250 },
  { month: "Jun", income: 10400, expenses: 7480 },
];

export const mockSpendingBreakdown: SpendingSlice[] = [
  { id: "housing", label: "Housing", amount: 3200, percent: 45, tone: "success" },
  { id: "lifestyle", label: "Lifestyle", amount: 1450, percent: 25, tone: "warning" },
  { id: "transport", label: "Transport", amount: 890, percent: 15, tone: "primary" },
  { id: "utilities", label: "Utilities", amount: 452, percent: 10, tone: "neutral" },
];

export const mockRecentActivity: ActivityItem[] = [
  { id: "a-01", merchant: "Whole Foods Market", category: "Groceries", date: "2024-06-14", amount: -184.2, icon: "cart" },
  { id: "a-02", merchant: "Apple Inc. Salary", category: "Income", date: "2024-06-13", amount: 5400, icon: "bank" },
  { id: "a-03", merchant: "Chevron Gas", category: "Fuel", date: "2024-06-12", amount: -62.0, icon: "car" },
  { id: "a-04", merchant: "Blue Bottle Coffee", category: "Dining", date: "2024-06-11", amount: -18.75, icon: "coffee" },
  { id: "a-05", merchant: "Harborview Apartments", category: "Housing", date: "2024-06-10", amount: -2150, icon: "home" },
  { id: "a-06", merchant: "City Power & Water", category: "Utilities", date: "2024-06-09", amount: -128.9, icon: "bolt" },
];

export const mockBudgetSnapshot: BudgetSnapshotItem[] = [
  { id: "housing", category: "Housing", spent: 2800, limit: 3500, tone: "primary" },
  { id: "dining", category: "Dining Out", spent: 780, limit: 800, tone: "warning" },
  { id: "transport", category: "Transport", spent: 225, limit: 500, tone: "success" },
  { id: "entertainment", category: "Entertainment", spent: 410, limit: 350, tone: "destructive" },
];

export const mockAiInsight = {
  headline: "AI Strategist",
  body: "You've spent 15% less on Dining this month. Consider moving the surplus of $450 to your High-Yield savings.",
  ctaLabel: "Review AI Suggestions",
};
