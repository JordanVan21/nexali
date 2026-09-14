import { describe, it, expect } from "vitest";
import { budgetToneFor, budgetStatusFor, deriveBudgetProgress } from "./budgetMath";
import type { Budget } from "./budgets";

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

describe("deriveBudgetProgress", () => {
  it("computes remaining as amount - spent, unclamped and negative when over budget", () => {
    const progress = deriveBudgetProgress(budget({ amount: 500 }), 550);

    expect(progress.spent).toBe(550);
    expect(progress.remaining).toBe(-50);
    expect(progress.isOverBudget).toBe(true);
    expect(progress.overAmount).toBe(50);
    expect(progress.actualPercent).toBeCloseTo(110);
    expect(progress.displayPercent).toBe(100); // clamped for the progress bar only
    expect(progress.status).toBe("over");
  });

  it("does not clamp the underlying financial numbers just because the bar clamps at 100%", () => {
    const progress = deriveBudgetProgress(budget({ amount: 100 }), 1000);

    expect(progress.actualPercent).toBe(1000);
    expect(progress.displayPercent).toBe(100);
    expect(progress.remaining).toBe(-900);
  });

  it("carries the real category id through for editing, not just the display name", () => {
    const progress = deriveBudgetProgress(budget({ category_id: 42, categories: { id: 42, name: "Dining", type: "expense" } }), 0);
    expect(progress.categoryId).toBe(42);
    expect(progress.category).toBe("Dining");
  });

  it("labels an uncategorized budget rather than showing a blank category", () => {
    const progress = deriveBudgetProgress(budget({ categories: null }), 0);
    expect(progress.category).toBe("Uncategorized");
  });

  it("does not divide by zero when the budget amount is 0", () => {
    const progress = deriveBudgetProgress(budget({ amount: 0 }), 0);
    expect(progress.displayPercent).toBe(0);
    expect(progress.actualPercent).toBe(0);
    expect(progress.status).toBe("normal");
  });

  it("defaults spend to 0 when there is no matching spend row, rather than throwing", () => {
    const progress = deriveBudgetProgress(budget({ amount: 200 }), 0);
    expect(progress.spent).toBe(0);
    expect(progress.remaining).toBe(200);
  });
});
