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

function tx(overrides: Omit<Partial<TransactionWithCat>, "occurred_at"> & { occurred_at: string | null }): TransactionWithCat {
  return {
    id: overrides.id ?? 1,
    amount: 0,
    merchant: null,
    note: null,
    category_id: 1,
    // A deliberately different created_at than occurred_at in every fixture
    // below that doesn't override it -- if any of these tests accidentally
    // read created_at instead of occurred_at, they would fail.
    created_at: "2099-01-01T00:00:00Z",
    categories: { id: 1, name: "Groceries", type: "expense" },
    ...overrides,
  } as TransactionWithCat;
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
    expect(isTransactionInRange(tx({ occurred_at: "2025-06-15T12:00:00Z" }), range)).toBe(true);
  });

  it("excludes a transaction before the range", () => {
    expect(isTransactionInRange(tx({ occurred_at: "2025-05-15T12:00:00Z" }), range)).toBe(false);
  });

  it("excludes a transaction after the range", () => {
    expect(isTransactionInRange(tx({ occurred_at: "2025-07-15T12:00:00Z" }), range)).toBe(false);
  });

  it("treats a null occurred_at as not in range rather than throwing", () => {
    expect(isTransactionInRange(tx({ occurred_at: null }), range)).toBe(false);
  });

  it("uses occurred_at, not created_at, to decide range membership", () => {
    // created_at (from the tx() helper default) is 2099-01-01 -- nowhere
    // near June 2025 -- yet this transaction must still count as "in range"
    // because occurred_at is what real financial-date classification uses.
    // Noon UTC, not midnight, so this is unambiguously June 1st in every
    // real-world local timezone the test could run in.
    const enteredLateButOccurredInJune = tx({ occurred_at: "2025-06-01T12:00:00Z" });
    expect(isTransactionInRange(enteredLateButOccurredInJune, range)).toBe(true);
  });
});

describe("isIncomeTx / isExpenseTx", () => {
  it("classifies by the transaction's category type, not amount sign", () => {
    const income = tx({ occurred_at: "2025-06-01T12:00:00Z", categories: { id: 9, name: "Salary", type: "income" } });
    const expense = tx({ occurred_at: "2025-06-01T12:00:00Z" });
    expect(isIncomeTx(income)).toBe(true);
    expect(isExpenseTx(income)).toBe(false);
    expect(isIncomeTx(expense)).toBe(false);
    expect(isExpenseTx(expense)).toBe(true);
  });

  it("treats a transaction with no category as neither income nor expense", () => {
    const uncategorized = tx({ occurred_at: "2025-06-01T12:00:00Z", categories: null });
    expect(isIncomeTx(uncategorized)).toBe(false);
    expect(isExpenseTx(uncategorized)).toBe(false);
  });
});

describe("sumTransactionAmounts", () => {
  it("sums amounts, coercing numeric-string values", () => {
    const transactions = [
      tx({ id: 1, amount: 10, occurred_at: "2025-06-01T12:00:00Z" }),
      tx({ id: 2, amount: "20.5" as unknown as number, occurred_at: "2025-06-02T12:00:00Z" }),
    ];
    expect(sumTransactionAmounts(transactions)).toBe(30.5);
  });

  it("returns 0 for an empty list", () => {
    expect(sumTransactionAmounts([])).toBe(0);
  });
});

describe("transactionTime", () => {
  it("returns 0 for a null occurred_at instead of throwing", () => {
    expect(transactionTime(tx({ occurred_at: null }))).toBe(0);
  });

  it("reads occurred_at, not created_at", () => {
    const t = tx({ occurred_at: "2025-06-15T12:00:00Z" });
    expect(transactionTime(t)).toBe(new Date("2025-06-15T12:00:00Z").getTime());
  });
});
