import { describe, it, expect } from "vitest";
import { buildTransactionsCsv } from "./csvExport";
import type { TransactionWithCat } from "./transactions";

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

describe("buildTransactionsCsv", () => {
  it("includes a header row and one row per real transaction", () => {
    const csv = buildTransactionsCsv([
      tx({ amount: 42.5, created_at: "2025-06-05T12:00:00Z", merchant: "Whole Foods" }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Date,Type,Category,Merchant,Note,Amount");
    expect(lines[1]).toBe("2025-06-05,expense,Groceries,Whole Foods,,42.5");
  });

  it("quotes and escapes fields containing commas or quotes", () => {
    const csv = buildTransactionsCsv([
      tx({ amount: 10, created_at: "2025-06-05T12:00:00Z", merchant: 'Bob\'s "Best" Deli, LLC' }),
    ]);
    expect(csv).toContain('"Bob\'s ""Best"" Deli, LLC"');
  });

  it("falls back to Uncategorized for a transaction with no category", () => {
    const csv = buildTransactionsCsv([tx({ amount: 5, created_at: "2025-06-05T12:00:00Z", categories: null })]);
    expect(csv.split("\r\n")[1]).toContain("Uncategorized");
  });

  it("returns just the header for an empty list", () => {
    expect(buildTransactionsCsv([])).toBe("Date,Type,Category,Merchant,Note,Amount");
  });
});
