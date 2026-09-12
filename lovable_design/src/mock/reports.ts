/**
 * Mock data only — replace with real Nexali hooks on integration.
 * Presentation components receive these shapes through props.
 */

export type ReportPeriod = "30d" | "6m" | "12m";

export type MonthlyFlow = {
  month: string;
  income: number;
  expenses: number;
};

export type CategorySlice = {
  id: string;
  name: string;
  amount: number;
  color: "primary" | "success" | "warning" | "destructive";
};

export type CashFlowPoint = {
  month: string;
  net: number;
};

export type TopCategory = {
  id: string;
  name: string;
  icon: "home" | "utensils" | "car" | "plane" | "shopping-bag" | "heart-pulse";
  transactions: number;
  amount: number;
  changePercent: number;
  tone: "primary" | "success" | "warning" | "destructive";
};

const monthlyFlow12: MonthlyFlow[] = [
  { month: "Jan", income: 7200, expenses: 4800 },
  { month: "Feb", income: 7350, expenses: 4600 },
  { month: "Mar", income: 6980, expenses: 5100 },
  { month: "Apr", income: 7500, expenses: 4400 },
  { month: "May", income: 7280, expenses: 5300 },
  { month: "Jun", income: 7620, expenses: 4900 },
  { month: "Jul", income: 7400, expenses: 5050 },
  { month: "Aug", income: 7800, expenses: 4700 },
  { month: "Sep", income: 7550, expenses: 5200 },
  { month: "Oct", income: 8100, expenses: 4850 },
  { month: "Nov", income: 7900, expenses: 5400 },
  { month: "Dec", income: 8250, expenses: 5600 },
];

export const mockReportsByPeriod: Record<ReportPeriod, MonthlyFlow[]> = {
  "12m": monthlyFlow12,
  "6m": monthlyFlow12.slice(6),
  "30d": monthlyFlow12.slice(-1),
};

export const mockCashFlowByPeriod: Record<ReportPeriod, CashFlowPoint[]> = {
  "12m": monthlyFlow12.map((m) => ({ month: m.month, net: m.income - m.expenses })),
  "6m": monthlyFlow12.slice(6).map((m) => ({ month: m.month, net: m.income - m.expenses })),
  "30d": monthlyFlow12.slice(-1).map((m) => ({ month: m.month, net: m.income - m.expenses })),
};

export const mockSpendingByCategory: CategorySlice[] = [
  { id: "housing", name: "Housing", amount: 4200, color: "primary" },
  { id: "investing", name: "Investing", amount: 3150, color: "success" },
  { id: "lifestyle", name: "Lifestyle", amount: 2100, color: "warning" },
  { id: "other", name: "Other", amount: 3000, color: "destructive" },
];

export const mockCategoryFilters = [
  "All Categories",
  "Housing",
  "Investing",
  "Lifestyle",
  "Other",
];

export const mockTopCategories: TopCategory[] = [
  { id: "housing", name: "Real Estate & Housing", icon: "home", transactions: 4, amount: 3240, changePercent: 2.4, tone: "primary" },
  { id: "dining", name: "Dining & Entertainment", icon: "utensils", transactions: 28, amount: 1180, changePercent: -6.1, tone: "warning" },
  { id: "transport", name: "Transportation", icon: "car", transactions: 14, amount: 640, changePercent: 3.8, tone: "success" },
  { id: "travel", name: "Travel", icon: "plane", transactions: 3, amount: 980, changePercent: 18.2, tone: "destructive" },
  { id: "shopping", name: "Shopping", icon: "shopping-bag", transactions: 11, amount: 512, changePercent: -1.2, tone: "primary" },
  { id: "health", name: "Health & Wellness", icon: "heart-pulse", transactions: 6, amount: 340, changePercent: 5.6, tone: "success" },
];

export const mockAverageMonthlySurplus = 2410.5;

export const mockReportSummary = {
  totalIncome: 90930,
  totalExpenses: 59900,
  netSavings: 31030,
  savingsRatePercent: 34.1,
};
