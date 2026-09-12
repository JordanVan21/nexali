/**
 * Mock data only — replace with real Nexali hooks on integration.
 * Presentation components receive these shapes through props.
 */

export type BudgetIcon = "home" | "restaurant" | "car" | "savings" | "cart" | "bolt" | "plane" | "gift";

export type BudgetStatus = "on-track" | "warning" | "over-budget";

export type Budget = {
  id: string;
  category: string;
  description: string;
  icon: BudgetIcon;
  limit: number;
  spent: number;
};

export const mockBudgets: Budget[] = [
  { id: "b-housing", category: "Housing", description: "Rent & utilities", icon: "home", limit: 3500, spent: 2800 },
  { id: "b-dining", category: "Dining Out", description: "Food & entertainment", icon: "restaurant", limit: 800, spent: 164.2 },
  { id: "b-transport", category: "Transport", description: "Fuel & transit", icon: "car", limit: 500, spent: 225 },
  { id: "b-investment", category: "Investment", description: "Crypto & stocks", icon: "savings", limit: 5000, spent: 4500 },
  { id: "b-groceries", category: "Groceries", description: "Household essentials", icon: "cart", limit: 650, spent: 690 },
  { id: "b-utilities", category: "Utilities", description: "Power, water & internet", icon: "bolt", limit: 300, spent: 128.9 },
];

export function getBudgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return "on-track";
  const ratio = spent / limit;
  if (ratio > 1) return "over-budget";
  if (ratio >= 0.85) return "warning";
  return "on-track";
}

export const budgetStatusLabel: Record<BudgetStatus, string> = {
  "on-track": "On track",
  warning: "Approaching limit",
  "over-budget": "Over budget",
};
