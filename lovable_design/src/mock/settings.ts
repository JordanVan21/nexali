/** Mock settings preferences — local-state only, replace with real Nexali hooks on integration. */

export type CurrencyOption = { value: string; label: string };
export type TimezoneOption = { value: string; label: string };
export type DateFormatOption = { value: string; label: string; preview: string };
export type NumberFormatOption = { value: string; label: string };

export const mockCurrencyOptions: CurrencyOption[] = [
  { value: "USD", label: "USD ($) · US Dollar" },
  { value: "EUR", label: "EUR (€) · Euro" },
  { value: "GBP", label: "GBP (£) · British Pound" },
  { value: "CAD", label: "CAD ($) · Canadian Dollar" },
  { value: "AUD", label: "AUD ($) · Australian Dollar" },
  { value: "JPY", label: "JPY (¥) · Japanese Yen" },
];

export const mockTimezoneOptions: TimezoneOption[] = [
  { value: "PST", label: "Pacific Time (America/Los_Angeles)" },
  { value: "MST", label: "Mountain Time (America/Denver)" },
  { value: "CST", label: "Central Time (America/Chicago)" },
  { value: "EST", label: "Eastern Time (America/New_York)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "GMT", label: "Greenwich Mean Time (Europe/London)" },
];

export const mockDateFormatOptions: DateFormatOption[] = [
  { value: "mdy", label: "MM/DD/YYYY", preview: "10/24/2025" },
  { value: "dmy", label: "DD/MM/YYYY", preview: "24/10/2025" },
  { value: "ymd", label: "YYYY-MM-DD", preview: "2025-10-24" },
];

export const mockNumberFormatOptions: NumberFormatOption[] = [
  { value: "standard", label: "1,234.56 (Standard comma separator)" },
  { value: "european", label: "1.234,56 (Period thousand separator)" },
  { value: "space", label: "1 234.56 (Thin space separator)" },
];

export const mockBudgetCycleOptions = [
  { value: "monthly", label: "Monthly (Recommended)" },
  { value: "biweekly", label: "Bi-weekly (Every 14 days)" },
  { value: "custom", label: "Custom cycle" },
];

export const mockResetDayOptions = [
  { value: "1", label: "1st of every month" },
  { value: "5", label: "5th of every month" },
  { value: "15", label: "15th of every month (Mid-month)" },
  { value: "last", label: "Last calendar day of the month" },
];

export type ResponseDetail = "concise" | "balanced" | "detailed";

export const mockResponseDetailOptions: { value: ResponseDetail; label: string; description: string }[] = [
  { value: "concise", label: "Concise", description: "Key numbers and brief summaries." },
  { value: "balanced", label: "Balanced", description: "Clear breakdown with context." },
  { value: "detailed", label: "Detailed", description: "Deep analytical commentary." },
];

export type MockSettings = {
  currency: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  budgetCycle: string;
  resetDay: string;
  reduceAnimations: boolean;
  showChartValues: boolean;
  notifyBudgetApproaching: boolean;
  notifyBudgetExceeded: boolean;
  notifyMonthlySummary: boolean;
  notifyAccountActivity: boolean;
  assistantUseFinancialData: boolean;
  assistantResponseDetail: ResponseDetail;
  assistantShowSuggestions: boolean;
};

export const mockSettings: MockSettings = {
  currency: "USD",
  timezone: "PST",
  dateFormat: "mdy",
  numberFormat: "standard",
  budgetCycle: "monthly",
  resetDay: "1",
  reduceAnimations: false,
  showChartValues: true,
  notifyBudgetApproaching: true,
  notifyBudgetExceeded: true,
  notifyMonthlySummary: true,
  notifyAccountActivity: true,
  assistantUseFinancialData: true,
  assistantResponseDetail: "balanced",
  assistantShowSuggestions: true,
};

export type Session = {
  id: string;
  device: string;
  location: string;
  detail: string;
  icon: "laptop" | "phone" | "tablet";
  current?: boolean;
};

export const mockSessions: Session[] = [
  {
    id: "s1",
    device: 'MacBook Pro 16"',
    location: "San Francisco, USA",
    detail: "Chrome v121.0",
    icon: "laptop",
    current: true,
  },
  {
    id: "s2",
    device: "iPhone 15 Pro",
    location: "London, UK",
    detail: "Mobile App v2.4.1",
    icon: "phone",
  },
  {
    id: "s3",
    device: "iPad Air",
    location: "Austin, USA",
    detail: "Safari v17.2",
    icon: "tablet",
  },
];

export type ConnectedAccount = {
  id: string;
  name: string;
  detail: string;
  connected: boolean;
};

export const mockConnectedAccounts: ConnectedAccount[] = [
  { id: "a1", name: "Chase Total Checking", detail: "Linked via Plaid • Synced 2 hours ago", connected: true },
  { id: "a2", name: "Google Calendar", detail: "Used for bill reminders", connected: true },
  { id: "a3", name: "Apple Health", detail: "Not connected", connected: false },
];
