import { describe, it, expect } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("formats a positive amount as USD by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("rounds to two decimal places", () => {
    expect(formatCurrency(9.999)).toBe("$10.00");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative amounts with a leading minus sign", () => {
    expect(formatCurrency(-42.5)).toBe("-$42.50");
  });

  it("supports a different currency and locale", () => {
    const result = formatCurrency(1234.5, "EUR", "de-DE");
    expect(result).toContain("1.234,50");
    expect(result).toContain("€");
  });
});
