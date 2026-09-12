/**
 * Mock data only — replace with real Nexali hooks on integration.
 * Presentation components receive these shapes through props.
 */

export type TransactionType = "Debit" | "Credit" | "Transfer" | "Automatic";

export type CategoryTone = "success" | "warning" | "primary" | "neutral";

export type TransactionCategory = {
  id: string;
  name: string;
  tone: CategoryTone;
  /** lucide-react icon key, resolved in the UI layer */
  icon: "cart" | "bolt" | "bank" | "car" | "coffee" | "home" | "gift" | "plane";
};

export type Transaction = {
  id: string;
  date: string; // ISO date
  merchant: string;
  category: TransactionCategory;
  type: TransactionType;
  /** negative = expense, positive = income */
  amount: number;
  note?: string;
};

export const mockCategories: TransactionCategory[] = [
  { id: "groceries", name: "Groceries", tone: "success", icon: "cart" },
  { id: "utilities", name: "Utilities", tone: "warning", icon: "bolt" },
  { id: "income", name: "Income", tone: "success", icon: "bank" },
  { id: "transport", name: "Transport", tone: "primary", icon: "car" },
  { id: "dining", name: "Dining", tone: "warning", icon: "coffee" },
  { id: "housing", name: "Housing", tone: "primary", icon: "home" },
  { id: "travel", name: "Travel", tone: "neutral", icon: "plane" },
  { id: "gifts", name: "Gifts", tone: "neutral", icon: "gift" },
];

const byId = (id: string) => mockCategories.find((c) => c.id === id)!;

export const mockTransactions: Transaction[] = [
  { id: "t-01", date: "2023-10-24", merchant: "Whole Foods Market", category: byId("groceries"), type: "Debit", amount: -142.6 },
  { id: "t-02", date: "2023-10-23", merchant: "Nexali Utilities Inc.", category: byId("utilities"), type: "Automatic", amount: -210.15 },
  { id: "t-03", date: "2023-10-22", merchant: "Stripe Payout", category: byId("income"), type: "Transfer", amount: 4250 },
  { id: "t-04", date: "2023-10-21", merchant: "Shell Oil", category: byId("transport"), type: "Credit", amount: -68.42 },
  { id: "t-05", date: "2023-10-20", merchant: "Blue Bottle Coffee", category: byId("dining"), type: "Debit", amount: -18.75 },
  { id: "t-06", date: "2023-10-19", merchant: "Harborview Apartments", category: byId("housing"), type: "Automatic", amount: -2150 },
  { id: "t-07", date: "2023-10-18", merchant: "Delta Air Lines", category: byId("travel"), type: "Credit", amount: -412.3 },
  { id: "t-08", date: "2023-10-17", merchant: "Trader Joe's", category: byId("groceries"), type: "Debit", amount: -96.14 },
  { id: "t-09", date: "2023-10-16", merchant: "Freelance Invoice #221", category: byId("income"), type: "Transfer", amount: 1800 },
  { id: "t-10", date: "2023-10-15", merchant: "Uber", category: byId("transport"), type: "Debit", amount: -34.8 },
  { id: "t-11", date: "2023-10-14", merchant: "City Power & Water", category: byId("utilities"), type: "Automatic", amount: -128.9 },
  { id: "t-12", date: "2023-10-13", merchant: "Sunset Bistro", category: byId("dining"), type: "Credit", amount: -87.25 },
  { id: "t-13", date: "2023-10-12", merchant: "Etsy Gift Shop", category: byId("gifts"), type: "Debit", amount: -54.0 },
  { id: "t-14", date: "2023-10-11", merchant: "Costco Wholesale", category: byId("groceries"), type: "Debit", amount: -231.47 },
  { id: "t-15", date: "2023-10-10", merchant: "Amtrak", category: byId("travel"), type: "Credit", amount: -142.0 },
];

export const mockTransactionTypes: TransactionType[] = ["Debit", "Credit", "Transfer", "Automatic"];

export const mockSpendingInsights = {
  averageDailyBurn: 184.2,
  changePercent: 12,
  sparkline: [40, 60, 35, 85, 95, 50, 70],
  topCategories: [
    { id: "essentials", label: "Essentials (Rent & Utilities)", percent: 45, tone: "primary" as const },
    { id: "lifestyle", label: "Lifestyle & Dining", percent: 22, tone: "success" as const },
    { id: "investments", label: "Investments & Savings", percent: 18, tone: "warning" as const },
  ],
};

export const mockUser = {
  name: "Jordan Van",
  email: "jordan@nexali.app",
  avatarUrl: "",
};

export const mockNotificationCount = 3;
