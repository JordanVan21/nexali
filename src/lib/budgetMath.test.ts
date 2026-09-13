import { describe, it, expect } from "vitest";
import { budgetToneFor, budgetStatusFor, computeBudgetSpend, computeBudgetProgress } from "./budgetMath";
import type { TransactionWithCat } from "./transactions";
import type { Budget } from "./budgets";

function tx(overrides: Partial<TransactionWithCat> & { created_at: string }): TransactionWithCat {
  return {
    id: overrides.id ?? 1,
    amount: 0,
    merchant: null,
    note: null,
    category_id: 1,
    categories: { id: 1, name: "Groceries", type: "expense" },
    ...overrides,
  };
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 1,
    amount: 200,
    month: 6,
    year: 2025,
    category_id: 1,
    categories: { id: 1, name: "Groceries", type: "expense" },
    ...overrides,
  };
}

describe("budgetToneFor", () => {
  it("is success below the warning threshold", () => {
    expect(budgetToneFor(74, 100)).toBe("success");
  });
  it("is warning at and above 75%", () => {
    expect(budgetToneFor(75, 100)).toBe("warning");
  });
  it("is destructive at and above 95%, including over budget", () => {
    expect(budgetToneFor(95, 100)).toBe("destructive");
    expect(budgetToneFor(150, 100)).toBe("destructive");
  });
  it("is success (not an error) when the limit is 0", () => {
    expect(budgetToneFor(50, 0)).toBe("success");
  });
});

describe("budgetStatusFor", () => {
  it("is normal below 75%", () => {
    expect(budgetStatusFor(74, 100)).toBe("normal");
  });
  it("is warning from 75% to under 95%", () => {
    expect(budgetStatusFor(75, 100)).toBe("warning");
    expect(budgetStatusFor(94, 100)).toBe("warning");
  });
  it("is critical from 95% up to and including 100%", () => {
    expect(budgetStatusFor(95, 100)).toBe("critical");
    expect(budgetStatusFor(100, 100)).toBe("critical");
  });
  it("is over once spending exceeds the limit", () => {
    expect(budgetStatusFor(100.01, 100)).toBe("over");
    expect(budgetStatusFor(550, 500)).toBe("over");
  });
});

describe("computeBudgetSpend", () => {
  it("sums only expense transactions in the budget's own category and month/year", () => {
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 50, created_at: "2025-06-05T12:00:00Z", category_id: 1 }),
      tx({ id: 2, amount: 25, created_at: "2025-06-10T12:00:00Z", category_id: 1 }),
      // Different category — must not count.
      tx({ id: 3, amount: 999, created_at: "2025-06-05T12:00:00Z", category_id: 2, categories: { id: 2, name: "Other", type: "expense" } }),
      // Right category, wrong month — must not count.
      tx({ id: 4, amount: 999, created_at: "2025-07-05T12:00:00Z", category_id: 1 }),
      // Right category and month, but income — must not count as spending.
      tx({ id: 5, amount: 999, created_at: "2025-06-05T12:00:00Z", category_id: 1, categories: { id: 1, name: "Groceries", type: "income" } }),
    ];

    expect(computeBudgetSpend(transactions, budget())).toBe(75);
  });

  it("uses the budget's own month/year, not the current date", () => {
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 40, created_at: "2024-01-15T12:00:00Z", category_id: 1 }),
    ];
    expect(computeBudgetSpend(transactions, budget({ month: 1, year: 2024 }))).toBe(40);
    expect(computeBudgetSpend(transactions, budget({ month: 6, year: 2025 }))).toBe(0);
  });

  it("returns 0 when there are no matching transactions", () => {
    expect(computeBudgetSpend([], budget())).toBe(0);
  });
});

describe("computeBudgetProgress", () => {
  it("computes remaining as amount - spent, unclamped and negative when over budget", () => {
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 550, created_at: "2025-06-05T12:00:00Z", category_id: 1 }),
    ];
    const progress = computeBudgetProgress(transactions, budget({ amount: 500 }));

    expect(progress.spent).toBe(550);
    expect(progress.remaining).toBe(-50);
    expect(progress.isOverBudget).toBe(true);
    expect(progress.overAmount).toBe(50);
    expect(progress.actualPercent).toBeCloseTo(110);
    expect(progress.displayPercent).toBe(100); // clamped for the progress bar only
    expect(progress.status).toBe("over");
  });

  it("does not clamp the underlying financial numbers just because the bar clamps at 100%", () => {
    const transactions: TransactionWithCat[] = [
      tx({ id: 1, amount: 1000, created_at: "2025-06-05T12:00:00Z", category_id: 1 }),
    ];
    const progress = computeBudgetProgress(transactions, budget({ amount: 100 }));

    expect(progress.actualPercent).toBe(1000);
    expect(progress.displayPercent).toBe(100);
    expect(progress.remaining).toBe(-900);
  });

  it("carries the real category id through for editing, not just the display name", () => {
    const progress = computeBudgetProgress([], budget({ category_id: 42, categories: { id: 42, name: "Dining", type: "expense" } }));
    expect(progress.categoryId).toBe(42);
    expect(progress.category).toBe("Dining");
  });

  it("labels an uncategorized budget rather than showing a blank category", () => {
    const progress = computeBudgetProgress([], budget({ categories: null }));
    expect(progress.category).toBe("Uncategorized");
  });

  it("does not divide by zero when the budget amount is 0", () => {
    const progress = computeBudgetProgress([], budget({ amount: 0 }));
    expect(progress.displayPercent).toBe(0);
    expect(progress.actualPercent).toBe(0);
    expect(progress.status).toBe("normal");
  });
});
