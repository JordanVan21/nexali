import { describe, it, expect } from "vitest";
import { parseReceiptImage } from "./receiptParser";

/**
 * Tests the MOCK adapter's own contract (see receiptParser.ts's module
 * doc): deterministic per file, real items/total/date shape, and the
 * documented error-simulation hook. This is NOT a real OCR/parser test --
 * there is no real backend yet (see the module doc for why).
 */
describe("parseReceiptImage (mock adapter)", () => {
  it("resolves with a real merchant, items, and a total", async () => {
    const file = new File(["x"], "grocery.jpg", { type: "image/jpeg" });
    const result = await parseReceiptImage(file);

    expect(typeof result.merchant).toBe("string");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.totalCents).toBeGreaterThan(0);
  });

  it("every item has a name, a positive quantity, and a positive totalCents", async () => {
    const file = new File(["x"], "receipt.jpg", { type: "image/jpeg" });
    const result = await parseReceiptImage(file);

    for (const item of result.items) {
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.quantity).toBeGreaterThan(0);
      expect(item.totalCents).toBeGreaterThan(0);
    }
  });

  it("returns a real ISO yyyy-mm-dd purchaseDate", async () => {
    const file = new File(["x"], "receipt.jpg", { type: "image/jpeg" });
    const result = await parseReceiptImage(file);
    expect(result.purchaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is deterministic for the same file name/size across calls", async () => {
    const file = () => new File(["x"], "same-file.jpg", { type: "image/jpeg" });
    const a = await parseReceiptImage(file());
    const b = await parseReceiptImage(file());
    expect(a.merchant).toBe(b.merchant);
    expect(a.items).toEqual(b.items);
  });

  it("different file names can produce different mock receipts (not always the exact same one)", async () => {
    const names = ["one.jpg", "two.jpg", "three.jpg", "four.jpg", "five.jpg", "six.jpg"];
    const results = await Promise.all(names.map((n) => parseReceiptImage(new File(["x"], n, { type: "image/jpeg" }))));
    const merchants = new Set(results.map((r) => r.merchant));
    // Any single pair could collide by chance (hash % 3), but across six
    // distinct names at least two different mock templates should appear.
    expect(merchants.size).toBeGreaterThan(1);
  });

  it("truthfully includes tax/tip rows when the mock template has them", async () => {
    const file = new File(["x"], "coffee-run.jpg", { type: "image/jpeg" });
    const result = await parseReceiptImage(file);
    // At least one of the three templates always carries an extra row;
    // run against several distinct names so this doesn't depend on which
    // template a specific filename happens to hash to.
    const anyHasExtraRows = await Promise.all(
      ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"].map(async (name) => {
        const r = await parseReceiptImage(new File(["x"], name, { type: "image/jpeg" }));
        return r.extraRows.length > 0;
      })
    );
    expect(anyHasExtraRows.some(Boolean)).toBe(true);
    expect(result).toBeTruthy(); // keeps `result` used
  });

  it("the reported total is never invented separately from items -- it's at least the items subtotal", async () => {
    const file = new File(["x"], "receipt.jpg", { type: "image/jpeg" });
    const result = await parseReceiptImage(file);
    const itemsSubtotal = result.items.reduce((sum, i) => sum + i.totalCents, 0);
    expect(result.totalCents).toBeGreaterThanOrEqual(itemsSubtotal);
  });

  it("rejects with a user-safe message for a filename simulating a parser failure (the mock's documented testing hook)", async () => {
    const file = new File(["x"], "bad-error-photo.jpg", { type: "image/jpeg" });
    await expect(parseReceiptImage(file)).rejects.toThrow(/couldn't read/i);
  });

  it("rejects for a filename containing 'fail' too", async () => {
    const file = new File(["x"], "fail-case.jpg", { type: "image/jpeg" });
    await expect(parseReceiptImage(file)).rejects.toBeTruthy();
  });
});
