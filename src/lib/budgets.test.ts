import { describe, it, expect, vi, afterEach } from "vitest";
import { getBudgets, isDuplicateBudgetError, upsertBudget } from "./budgets";

/**
 * Regression coverage for a real financial-correctness bug (2026-09-15):
 * getBudgets()'s `.select()` string never requested the `category_id`
 * column -- only `id, amount, month, year` plus the nested `categories`
 * join. Every real consumer of `Budget.category_id` (budgetMath.ts's
 * deriveBudgetProgress, useBudgetsForPeriod.ts, dashboardMath.ts,
 * useReportsData.ts) looks up server-computed per-category spend by
 * `budget.category_id`, so with the column never actually fetched, EVERY
 * budget's spend silently fell back to its `?? -1`/`?? 0` default -- a
 * real $25 Food And Dining expense against a real $250 Food And Dining
 * budget (same category_id on both sides, confirmed via live read-only
 * DB introspection) displayed as $0 spent / $250 remaining / 0% on the
 * Budgets page, Dashboard's budget snapshot, and Reports' budget
 * comparison alike.
 *
 * This bug was invisible to the existing test suite because
 * useBudgetsForPeriod.test.tsx (and every other budget-progress test)
 * mocks `useBudgets`/`getBudgets` at the HOOK boundary with fixtures that
 * already include `category_id` -- none of them exercised the real
 * Supabase `.select()` string. This file exists specifically to close
 * that gap: it asserts on the real select() call args and on a
 * realistic mocked PostgREST response shape.
 */

type ChainResult = { data: unknown[] | null; error: null };

interface SupabaseChainMock extends PromiseLike<ChainResult> {
  select: (...args: unknown[]) => SupabaseChainMock;
  eq: (...args: unknown[]) => SupabaseChainMock;
  order: (...args: unknown[]) => SupabaseChainMock;
  throwOnError: (...args: unknown[]) => SupabaseChainMock;
  insert: (...args: unknown[]) => SupabaseChainMock;
  update: (...args: unknown[]) => SupabaseChainMock;
  delete: (...args: unknown[]) => SupabaseChainMock;
  single: (...args: unknown[]) => SupabaseChainMock;
}

function makeChainable(result: ChainResult): SupabaseChainMock {
  const chain: SupabaseChainMock = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    throwOnError: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    single: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

vi.mock("../supabaseClient", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../supabaseClient";

function mockFrom(result: ChainResult) {
  const chain = makeChainable(result);
  vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);
  return chain;
}

function budgetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 19,
    amount: "250.00",
    month: 9,
    year: 2026,
    category_id: 31,
    categories: { id: 31, name: "Food And Dining" },
    ...overrides,
  };
}

describe("getBudgets", () => {
  afterEach(() => vi.clearAllMocks());

  it("selects category_id explicitly -- the exact regression this bug was", async () => {
    const chain = mockFrom({ data: [budgetRow()], error: null });
    await getBudgets("u1");

    const selectArg = vi.mocked(chain.select).mock.calls[0][0] as string;
    expect(selectArg).toMatch(/(^|[\s,])category_id([\s,]|$)/);
  });

  it("returns a Budget row whose category_id is the real numeric FK, not undefined", async () => {
    mockFrom({ data: [budgetRow({ category_id: 31 })], error: null });
    const [budget] = await getBudgets("u1");

    expect(budget.category_id).toBe(31);
  });

  it("scopes the query to the given user and orders newest period first", async () => {
    const chain = mockFrom({ data: [], error: null });
    await getBudgets("u1");

    expect(chain.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(chain.order).toHaveBeenCalledWith("year", { ascending: false });
    expect(chain.order).toHaveBeenCalledWith("month", { ascending: false });
  });

  it("still carries the joined category name/id for display, alongside the flat category_id", async () => {
    mockFrom({ data: [budgetRow({ category_id: 31, categories: { id: 31, name: "Food And Dining" } })], error: null });
    const [budget] = await getBudgets("u1");

    expect(budget.categories).toEqual({ id: 31, name: "Food And Dining" });
    expect(budget.category_id).toBe(budget.categories?.id);
  });

  it("returns an empty array (not a throw) on a real query error, matching its existing defensive contract", async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error("network down");
    });
    expect(await getBudgets("u1")).toEqual([]);
  });
});

describe("upsertBudget", () => {
  afterEach(() => vi.clearAllMocks());

  it("inserts a new budget carrying the real category_id", async () => {
    // .insert(...).select("id").single() resolves with a single row --
    // the shared chain mock's `then` already carries this result.
    const chain = mockFrom({ data: { id: 19 } as unknown as unknown[], error: null });

    const result = await upsertBudget({ userId: "u1", categoryId: 31, amount: 250, month: 9, year: 2026 });
    expect(result.id).toBe(19);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", category_id: 31, amount: 250, month: 9, year: 2026 })
    );
  });
});

describe("isDuplicateBudgetError", () => {
  it("recognizes the real unique-constraint violation code", () => {
    expect(isDuplicateBudgetError({ code: "23505" })).toBe(true);
  });

  it("recognizes the constraint name in the error message as a fallback", () => {
    expect(isDuplicateBudgetError({ message: "duplicate key value violates budgets_user_id_category_id_month_year_key" })).toBe(true);
  });

  it("returns false for an unrelated error", () => {
    expect(isDuplicateBudgetError({ code: "23503", message: "foreign key violation" })).toBe(false);
  });
});
