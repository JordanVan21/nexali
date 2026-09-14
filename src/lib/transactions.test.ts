import { describe, it, expect, vi, afterEach } from "vitest";
import { transactionsWithFilters, fetchAllTransactionsWithFilters } from "./transactions";
import type { Filters } from "../features/querykeys";

type ChainResult = { data: unknown[] | null; error: null; count: number | null };

interface SupabaseChainMock extends PromiseLike<ChainResult> {
  select: (...args: unknown[]) => SupabaseChainMock;
  eq: (...args: unknown[]) => SupabaseChainMock;
  gte: (...args: unknown[]) => SupabaseChainMock;
  lt: (...args: unknown[]) => SupabaseChainMock;
  lte: (...args: unknown[]) => SupabaseChainMock;
  in: (...args: unknown[]) => SupabaseChainMock;
  or: (...args: unknown[]) => SupabaseChainMock;
  order: (...args: unknown[]) => SupabaseChainMock;
  range: (...args: unknown[]) => SupabaseChainMock;
  returns: (...args: unknown[]) => SupabaseChainMock;
}

function makeChainable(result: ChainResult): SupabaseChainMock {
  const chain: SupabaseChainMock = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    returns: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

vi.mock("../supabaseClient", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../supabaseClient";

function mockRow(id: number) {
  return {
    id,
    amount: 10,
    category_id: 1,
    merchant: "Test",
    note: null,
    created_at: "2024-01-01T00:00:00.000Z",
    occurred_at: "2024-01-01T00:00:00.000Z",
    category_name: "Groceries",
    category_type: "expense",
  };
}

function mockFrom(result: ChainResult) {
  const chain = makeChainable(result);
  vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);
  return chain;
}

/**
 * Queues one chain per call to supabase.from(...) -- fetchAllTransactionsWithFilters
 * calls .from() fresh for every batch, so this lets each batch return its
 * own result and lets tests assert on each batch's own .range()/.order()/
 * filter calls individually.
 */
function mockFromSequence(results: ChainResult[]): SupabaseChainMock[] {
  const chains = results.map(makeChainable);
  let call = 0;
  vi.mocked(supabase.from).mockImplementation(() => {
    const chain = chains[call] ?? chains[chains.length - 1];
    call++;
    return chain as unknown as ReturnType<typeof supabase.from>;
  });
  return chains;
}

function makeRows(count: number, startId = 1) {
  return Array.from({ length: count }, (_, i) => mockRow(startId + i));
}

/** Splits `total` rows into EXPORT_BATCH_SIZE-sized ChainResults, each reporting the real exact total. */
function batchedResults(total: number, batchSize: number): ChainResult[] {
  const results: ChainResult[] = [];
  let produced = 0;
  do {
    const size = Math.min(batchSize, total - produced);
    results.push({ data: makeRows(size, produced + 1), error: null, count: total });
    produced += size;
  } while (produced < total);
  return results;
}

const NO_FILTERS: Filters = {};

describe("transactionsWithFilters (real server pagination)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requests range(0, 9) and reports the real total for a default page (pageSize 10, page 1) of 0 matching rows", async () => {
    const chain = mockFrom({ data: [], error: null, count: 0 });

    const result = await transactionsWithFilters("u1", NO_FILTERS);

    expect(chain.range).toHaveBeenCalledWith(0, 9);
    expect(result).toEqual({ rows: [], totalCount: 0 });
  });

  it("returns exactly the fetched page and the real total for 1 matching row", async () => {
    mockFrom({ data: [mockRow(1)], error: null, count: 1 });

    const result = await transactionsWithFilters("u1", { limit: 10, offset: 0 });

    expect(result.rows).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it("requests exactly range(0, 9) for page 1 of a 10-row result and reports totalCount 10", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => mockRow(i + 1));
    const chain = mockFrom({ data: rows, error: null, count: 10 });

    const result = await transactionsWithFilters("u1", { limit: 10, offset: 0 });

    expect(chain.range).toHaveBeenCalledWith(0, 9);
    expect(result.rows).toHaveLength(10);
    expect(result.totalCount).toBe(10);
  });

  it("reports totalCount 11 with a page-1 fetch of only 10 rows, and a real page-2 request for the 11th", async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => mockRow(i + 1));
    mockFrom({ data: page1, error: null, count: 11 });
    const page1Result = await transactionsWithFilters("u1", { limit: 10, offset: 0 });
    expect(page1Result.rows).toHaveLength(10);
    expect(page1Result.totalCount).toBe(11);

    const page2Chain = mockFrom({ data: [mockRow(11)], error: null, count: 11 });
    const page2Result = await transactionsWithFilters("u1", { limit: 10, offset: 10 });
    expect(page2Chain.range).toHaveBeenCalledWith(10, 19);
    expect(page2Result.rows).toHaveLength(1);
    expect(page2Result.totalCount).toBe(11);
  });

  it("reports the true totalCount of 200 even though only one page (10 rows) is fetched -- no 50-row ceiling", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => mockRow(i + 1));
    const chain = mockFrom({ data: rows, error: null, count: 200 });

    const result = await transactionsWithFilters("u1", { limit: 10, offset: 0 });

    expect(chain.range).toHaveBeenCalledWith(0, 9);
    expect(result.rows).toHaveLength(10);
    expect(result.totalCount).toBe(200);
  });

  it.each([25, 50, 51, 75])(
    "correctly requests range(0, 9) and reports totalCount %i regardless of true match count",
    async (trueTotal) => {
      const rows = Array.from({ length: 10 }, (_, i) => mockRow(i + 1));
      const chain = mockFrom({ data: rows, error: null, count: trueTotal });

      const result = await transactionsWithFilters("u1", { limit: 10, offset: 0 });

      expect(chain.range).toHaveBeenCalledWith(0, 9);
      expect(result.totalCount).toBe(trueTotal);
    }
  );

  it("computes the correct range for an arbitrary later page (page 8 of pageSize 10)", async () => {
    const chain = mockFrom({ data: [mockRow(80)], error: null, count: 75 });

    await transactionsWithFilters("u1", { limit: 10, offset: 70 });

    expect(chain.range).toHaveBeenCalledWith(70, 79);
  });

  it("applies sort before pagination by passing the sort to .order() on the same chain used for .range()", async () => {
    const chain = mockFrom({ data: [], error: null, count: 0 });

    await transactionsWithFilters("u1", { sortBy: "amount", sortOrder: "asc", limit: 10, offset: 0 });

    expect(chain.order).toHaveBeenCalledWith("amount", { ascending: true });
    expect(chain.range).toHaveBeenCalledWith(0, 9);
  });

  it("defaults the 'date' sort to the real financial occurred_at column, not created_at", async () => {
    const chain = mockFrom({ data: [], error: null, count: 0 });

    await transactionsWithFilters("u1", { limit: 10, offset: 0 }); // no sortBy -- the default

    expect(chain.order).toHaveBeenCalledWith("occurred_at", { ascending: false });
    expect(chain.order).not.toHaveBeenCalledWith("created_at", expect.anything());
  });

  it("passes every active filter to the query", async () => {
    const chain = mockFrom({ data: [], error: null, count: 0 });

    await transactionsWithFilters("u1", {
      fromISO: "2024-01-01",
      toISO: "2024-02-01",
      categoryNames: ["Groceries"],
      types: ["expense"],
      minAmount: 5,
      maxAmount: 100,
      search: "coffee",
    });

    expect(chain.gte).toHaveBeenCalledWith("occurred_at", "2024-01-01");
    expect(chain.lt).toHaveBeenCalledWith("occurred_at", "2024-02-01");
    expect(chain.in).toHaveBeenCalledWith("category_name", ["Groceries"]);
    expect(chain.in).toHaveBeenCalledWith("category_type", ["expense"]);
    expect(chain.gte).toHaveBeenCalledWith("amount", 5);
    expect(chain.lte).toHaveBeenCalledWith("amount", 100);
    expect(chain.or).toHaveBeenCalledWith("merchant.ilike.%coffee%,note.ilike.%coffee%");
  });

  it("throws the real Supabase error rather than swallowing it", async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChainable({
        data: null,
        error: { message: "permission denied" } as unknown as null,
        count: null,
      }) as unknown as ReturnType<typeof supabase.from>
    );

    await expect(transactionsWithFilters("u1", NO_FILTERS)).rejects.toBeTruthy();
  });
});

describe("fetchAllTransactionsWithFilters (batched export path)", () => {
  const BATCH_SIZE = 500;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a flat array (not a {rows,totalCount} page object)", async () => {
    mockFromSequence(batchedResults(1, BATCH_SIZE));

    const result = await fetchAllTransactionsWithFilters("u1", NO_FILTERS);

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({ id: 1 });
  });

  it.each([
    { total: 0, expectedRequests: 1, expectedRanges: [[0, 499]] },
    { total: 1, expectedRequests: 1, expectedRanges: [[0, 499]] },
    { total: 499, expectedRequests: 1, expectedRanges: [[0, 499]] },
    { total: 500, expectedRequests: 1, expectedRanges: [[0, 499]] },
    { total: 501, expectedRequests: 2, expectedRanges: [[0, 499], [500, 999]] },
    { total: 1000, expectedRequests: 2, expectedRanges: [[0, 499], [500, 999]] },
    {
      total: 1001,
      expectedRequests: 3,
      expectedRanges: [
        [0, 499],
        [500, 999],
        [1000, 1499],
      ],
    },
    {
      total: 1500,
      expectedRequests: 3,
      expectedRanges: [
        [0, 499],
        [500, 999],
        [1000, 1499],
      ],
    },
    {
      total: 2500,
      expectedRequests: 5,
      expectedRanges: [
        [0, 499],
        [500, 999],
        [1000, 1499],
        [1500, 1999],
        [2000, 2499],
      ],
    },
  ])(
    "fetches exactly $total rows in $expectedRequests real batched request(s), no more and no fewer",
    async ({ total, expectedRequests, expectedRanges }) => {
      const chains = mockFromSequence(batchedResults(total, BATCH_SIZE));

      const result = await fetchAllTransactionsWithFilters("u1", NO_FILTERS);

      // Exactly the right number of real server requests -- never one
      // unbounded request, and never more batches than actually needed.
      expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(expectedRequests);

      // Every request used a real, correctly-bounded range -- no single
      // request ever asks for more than BATCH_SIZE rows at once.
      chains.slice(0, expectedRequests).forEach((chain, i) => {
        expect(chain.range).toHaveBeenCalledWith(...expectedRanges[i]);
        const [from, to] = expectedRanges[i];
        expect(to - from + 1).toBeLessThanOrEqual(BATCH_SIZE);
      });

      // All rows present, no duplicates, no gaps.
      expect(result).toHaveLength(total);
      const ids = result.map((r) => r.id);
      expect(new Set(ids).size).toBe(total);
      expect([...ids].sort((a, b) => a - b)).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    }
  );

  it("applies every filter and the sort identically on every batch request", async () => {
    const chains = mockFromSequence(batchedResults(1001, BATCH_SIZE));

    await fetchAllTransactionsWithFilters("u1", {
      fromISO: "2024-01-01",
      toISO: "2024-02-01",
      categoryNames: ["Groceries"],
      types: ["expense"],
      minAmount: 5,
      maxAmount: 100,
      search: "coffee",
      sortBy: "amount",
      sortOrder: "asc",
    });

    expect(chains).toHaveLength(3);
    for (const chain of chains) {
      expect(chain.gte).toHaveBeenCalledWith("occurred_at", "2024-01-01");
      expect(chain.lt).toHaveBeenCalledWith("occurred_at", "2024-02-01");
      expect(chain.in).toHaveBeenCalledWith("category_name", ["Groceries"]);
      expect(chain.in).toHaveBeenCalledWith("category_type", ["expense"]);
      expect(chain.gte).toHaveBeenCalledWith("amount", 5);
      expect(chain.lte).toHaveBeenCalledWith("amount", 100);
      expect(chain.or).toHaveBeenCalledWith("merchant.ilike.%coffee%,note.ilike.%coffee%");
      expect(chain.order).toHaveBeenCalledWith("amount", { ascending: true });
      // Deterministic secondary tiebreak so ties can't shift between batches.
      expect(chain.order).toHaveBeenCalledWith("id", { ascending: true });
    }
  });

  it("rejects the whole export when a later batch fails, never returning a partial result", async () => {
    const [batch1] = batchedResults(1001, BATCH_SIZE);
    const failingChain = makeChainable({
      data: null,
      error: { message: "connection reset" } as unknown as null,
      count: null,
    });
    let call = 0;
    const successChain = makeChainable(batch1);
    vi.mocked(supabase.from).mockImplementation(() => {
      call++;
      // First batch succeeds, second batch (the one beyond the first
      // real request) fails.
      return (call === 1 ? successChain : failingChain) as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(fetchAllTransactionsWithFilters("u1", NO_FILTERS)).rejects.toBeTruthy();
  });

  it("makes only one request when the exact count is already satisfied by the first batch (no trailing empty request)", async () => {
    mockFromSequence(batchedResults(500, BATCH_SIZE));

    await fetchAllTransactionsWithFilters("u1", NO_FILTERS);

    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1);
  });
});
