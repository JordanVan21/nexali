import { describe, it, expect } from "vitest";
import { formatCurrency as formatCurrencyRaw } from "./format";

const NBSP = String.fromCharCode(160);

/** Normalizes Intl's non-breaking spaces to plain ASCII spaces so string assertions don't depend on invisible-character trivia. */
function formatCurrency(...args: Parameters<typeof formatCurrencyRaw>): string {
  return formatCurrencyRaw(...args).split(NBSP).join(" ");
}

describe("formatCurrency", () => {
  it("formats a positive amount as USD/standard by default", () => {
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

  it("formats a large amount with the standard comma-thousands separator", () => {
    expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
  });

  it("supports a different persisted currency (EUR)", () => {
    expect(formatCurrency(1234.5, "EUR")).toBe("€1,234.50");
  });

  it("supports a different persisted currency (JPY, zero decimal places by ISO convention)", () => {
    expect(formatCurrency(1234, "JPY")).toBe("¥1,234");
  });

  describe("number-format preference (separator convention only)", () => {
    it("standard: comma thousands, period decimal", () => {
      expect(formatCurrency(1234.56, "USD", "standard")).toBe("$1,234.56");
    });

    it("european: period thousands, comma decimal (symbol placement follows the German convention)", () => {
      expect(formatCurrency(1234.56, "USD", "european")).toBe("1.234,56 $");
    });

    it("space: space thousands, period decimal (Nexali's documented example)", () => {
      expect(formatCurrency(1234.56, "USD", "space")).toBe("$1 234.56");
    });

    it("does not affect small amounts with no thousands separator to show", () => {
      expect(formatCurrency(9.99, "USD", "european")).toBe("9,99 $");
      expect(formatCurrency(9.99, "USD", "space")).toBe("$9.99");
    });
  });

  describe("currency and number-format act independently", () => {
    it("a non-USD currency still honors the 'standard' separator style, not the currency's own regional convention", () => {
      // EUR with "standard" (US-style) separators -- the euro symbol, but
      // comma-thousands/period-decimal, not German-style period/comma.
      expect(formatCurrency(1234.5, "EUR", "standard")).toBe("€1,234.50");
    });

    it("a non-USD currency also honors the 'space' separator style", () => {
      expect(formatCurrency(1234.5, "GBP", "space")).toBe("£1 234.50");
    });

    it("changing number-format never changes the currency symbol/code", () => {
      const standard = formatCurrency(1234.5, "CAD", "standard");
      const european = formatCurrency(1234.5, "CAD", "european");
      const space = formatCurrency(1234.5, "CAD", "space");
      expect(standard).toContain("CA$");
      expect(european).toContain("CA$");
      expect(space).toContain("CA$");
    });
  });

  it("does not perform FX conversion: the same numeric amount is shown under every currency, never rescaled", () => {
    const amount = 1000;
    // Same numeric magnitude every time -- only the symbol/code changed.
    for (const currency of ["USD", "EUR", "GBP"] as const) {
      const result = formatCurrency(amount, currency);
      expect(result).toMatch(/1,000\.00/);
    }
  });
});
