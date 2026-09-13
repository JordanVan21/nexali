import { describe, it, expect } from "vitest";
import {
  monthRange,
  isTransactionInRange,
  isIncomeTx,
  isExpenseTx,
  sumTransactionAmounts,
  transactionTime,
} from "./financialPeriods";
import type { TransactionWithCat } from "./transactions";

function tx(overrides: Partial<TransactionWithCat> & { created_at: string | null }): TransactionWithCat {
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

describe("monthRange", () => {
  it("returns a start-inclusive, end-exclusive range spanning exactly one calendar month", () => {
    const { start, end } = monthRange(2025, 5); // June (0-based)
    expect(start).toEqual(new Date(2025, 5, 1));
    expect(end).toEqual(new Date(2025, 6, 1));
  });

  it("rolls over into the next year when the month index is December", () => {
    const { end } = monthRange(2025, 11);
    expect(end).toEqual(new Date(2026, 0, 1));
  });
});

describe("isTransactionInRange", () => {
  const range = monthRange(2025, 5); // June 2025

  it("includes a transaction inside the range", () => {
    expect(isTransactionInRange(tx({ created_at: "2025-06-15T12:00:00Z" }), range)).toBe(true);
  });

  it("excludes a transaction before the range", () => {
    expect(isTransactionInRange(tx({ created_at: "2025-05-15T12:00:00Z" }), range)).toBe(false);
  });

  it("excludes a transaction after the range", () => {
    expect(isTransactionInRange(tx({ created_at: "2025-07-15T12:00:00Z" }), range)).toBe(false);
  });

  it("treats a null created_at as not in range rather than throwing", () => {
    expect(isTransactionInRange(tx({ created_at: null }), range)).toBe(false);
  });
});

describe("isIncomeTx / isExpenseTx", () => {
  it("classifies by the transaction's category type, not amount sign", () => {
    const income = tx({ created_at: "2025-06-01T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } });
    const expense = tx({ created_at: "2025-06-01T12:00:00Z" });
    expect(isIncomeTx(income)).toBe(true);
    expect(isExpenseTx(income)).toBe(false);
    expect(isIncomeTx(expense)).toBe(false);
    expect(isExpenseTx(expense)).toBe(true);
  });

  it("treats a transaction with no category as neither income nor expense", () => {
    const uncategorized = tx({ created_at: "2025-06-01T12:00:00Z", categories: null });
    expect(isIncomeTx(uncategorized)).toBe(false);
    expect(isExpenseTx(uncategorized)).toBe(false);
  });
});

describe("sumTransactionAmounts", () => {
  it("sums amounts, coercing numeric-string values", () => {
    const transactions = [
      tx({ id: 1, amount: 10, created_at: "2025-06-01T12:00:00Z" }),
      tx({ id: 2, amount: "20.5" as unknown as number, created_at: "2025-06-02T12:00:00Z" }),
    ];
    expect(sumTransactionAmounts(transactions)).toBe(30.5);
  });

  it("returns 0 for an empty list", () => {
    expect(sumTransactionAmounts([])).toBe(0);
  });
});

describe("transactionTime", () => {
  it("returns 0 for a null created_at instead of throwing", () => {
    expect(transactionTime(tx({ created_at: null }))).toBe(0);
  });
});
