import { describe, it, expect, vi, afterEach } from "vitest";
import { getTransactionCategoryCounts, getTransactionsActivitySummary } from "./financialAggregates";

vi.mock("../supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from "../supabaseClient";

describe("getTransactionCategoryCounts", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls transaction_category_counts with no arguments", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
    await getTransactionCategoryCounts();
    expect(supabase.rpc).toHaveBeenCalledWith("transaction_category_counts");
  });

  it("coerces category_name/count from the raw RPC rows", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [
        { category_name: "Groceries", count: 5 },
        { category_name: "Uncategorized", count: "12" }, // bigint can arrive as a string over the wire
      ],
      error: null,
    } as never);

    const result = await getTransactionCategoryCounts();
    expect(result).toEqual([
      { categoryName: "Groceries", count: 5 },
      { categoryName: "Uncategorized", count: 12 },
    ]);
  });

  it("returns an empty array rather than throwing when the RPC returns no rows", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    expect(await getTransactionCategoryCounts()).toEqual([]);
  });

  it("throws the real Supabase error rather than swallowing it", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "permission denied" } } as never);
    await expect(getTransactionCategoryCounts()).rejects.toBeTruthy();
  });
});

describe("getTransactionsActivitySummary", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes p_from/p_to as null when no date filter is active", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rawSummary(), error: null } as never);
    await getTransactionsActivitySummary();
    expect(supabase.rpc).toHaveBeenCalledWith("transactions_activity_summary", { p_from: null, p_to: null });
  });

  it("passes the exact fromISO/toISO through as p_from/p_to when a date filter is active", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rawSummary(), error: null } as never);
    await getTransactionsActivitySummary("2024-03-05T08:00:00.000Z", "2024-03-08T08:00:00.000Z");
    expect(supabase.rpc).toHaveBeenCalledWith("transactions_activity_summary", {
      p_from: "2024-03-05T08:00:00.000Z",
      p_to: "2024-03-08T08:00:00.000Z",
    });
  });

  it("coerces every numeric field and preserves null previousDailyRate/changePercent", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: rawSummary({ previousDailyRate: null, changePercent: null }),
      error: null,
    } as never);

    const result = await getTransactionsActivitySummary();
    expect(result.previousDailyRate).toBeNull();
    expect(result.changePercent).toBeNull();
    expect(result.dailyRate).toBe(10);
    expect(typeof result.days).toBe("number");
  });

  it("maps dailyBuckets and topCategories arrays", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: rawSummary({
        dailyBuckets: [{ date: "2024-03-05T08:00:00.000Z", amount: 25 }],
        topCategories: [{ id: 1, label: "Groceries", amount: 100, percent: 50 }],
      }),
      error: null,
    } as never);

    const result = await getTransactionsActivitySummary();
    expect(result.dailyBuckets).toEqual([{ date: "2024-03-05T08:00:00.000Z", amount: 25 }]);
    expect(result.topCategories).toEqual([{ id: 1, label: "Groceries", amount: 100, percent: 50 }]);
  });

  it("throws the real Supabase error rather than swallowing it", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "bad input" } } as never);
    await expect(getTransactionsActivitySummary()).rejects.toBeTruthy();
  });
});

function rawSummary(overrides: Record<string, unknown> = {}) {
  return {
    rangeStart: "2024-03-01T08:00:00.000Z",
    rangeEnd: "2024-03-11T08:00:00.000Z",
    previousRangeStart: "2024-02-01T08:00:00.000Z",
    previousRangeEnd: "2024-03-01T08:00:00.000Z",
    days: 10,
    previousDays: 29,
    isCustomRange: false,
    expenseAmount: 100,
    dailyRate: 10,
    previousDailyRate: 5,
    changePercent: 100,
    dailyBuckets: [],
    topCategories: [],
    ...overrides,
  };
}
