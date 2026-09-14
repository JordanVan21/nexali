import { describe, it, expect } from "vitest";
import { buildTransactionsCsv } from "./csvExport";
import type { TransactionWithCat } from "./transactions";

function tx(overrides: Partial<TransactionWithCat> & { occurred_at: string }): TransactionWithCat {
  return {
    id: overrides.id ?? 1,
    amount: 0,
    merchant: null,
    note: null,
    category_id: 1,
    created_at: "2099-01-01T00:00:00Z",
    categories: { id: 1, name: "Groceries", type: "expense" },
    ...overrides,
  };
}

describe("buildTransactionsCsv", () => {
  it("includes a header row and one row per real transaction", () => {
    const csv = buildTransactionsCsv([
      tx({ amount: 42.5, occurred_at: "2025-06-05T12:00:00Z", merchant: "Whole Foods" }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Date,Type,Category,Merchant,Note,Amount");
    expect(lines[1]).toBe("2025-06-05,expense,Groceries,Whole Foods,,42.5");
  });

  it("the Date column is the real financial occurred_at, not the technical created_at", () => {
    // created_at (from the tx() helper default) is 2099-01-01 -- if the
    // Date column ever regresses to reading created_at, this would fail.
    const csv = buildTransactionsCsv([tx({ amount: 10, occurred_at: "2025-06-05T12:00:00Z" })]);
    const lines = csv.split("\r\n");
    expect(lines[1].startsWith("2025-06-05,")).toBe(true);
    expect(csv).not.toContain("2099-01-01");
  });

  it("quotes and escapes fields containing commas or quotes", () => {
    const csv = buildTransactionsCsv([
      tx({ amount: 10, occurred_at: "2025-06-05T12:00:00Z", merchant: 'Bob\'s "Best" Deli, LLC' }),
    ]);
    expect(csv).toContain('"Bob\'s ""Best"" Deli, LLC"');
  });

  it("falls back to Uncategorized for a transaction with no category", () => {
    const csv = buildTransactionsCsv([tx({ amount: 5, occurred_at: "2025-06-05T12:00:00Z", categories: null })]);
    expect(csv.split("\r\n")[1]).toContain("Uncategorized");
  });

  it("returns just the header for an empty list", () => {
    expect(buildTransactionsCsv([])).toBe("Date,Type,Category,Merchant,Note,Amount");
  });
});
