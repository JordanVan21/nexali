import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useBudgetsForPeriod } from "./useBudgetsForPeriod";

/**
 * End-to-end regression coverage for the real "$25 Wendy's expense doesn't
 * count against the $250 Food And Dining budget" bug (2026-09-15).
 *
 * Unlike useBudgetsForPeriod.test.tsx (which mocks useBudgets/
 * useBudgetsProgress at the HOOK boundary with fixtures that already
 * include category_id -- exactly the level that could never have caught
 * this bug), this file mocks ONLY the Supabase client, so the REAL
 * getBudgets() (src/lib/budgets.ts) and getBudgetsProgress()
 * (src/lib/financialAggregates.ts) data-access code runs exactly as
 * production does -- including the real .select() string that was
 * silently missing `category_id`.
 *
 * Fixture shapes mirror the actual live rows confirmed via read-only DB
 * introspection: budget id 19 (Food And Dining, category_id 31, $250,
 * September 2026) and a $25 September Wendy's expense, with
 * budgets_progress(2026, 9) really returning {category_id: 31, spent: 25}.
 */

type ChainResult = { data: unknown; error: null };

interface SupabaseChainMock extends PromiseLike<ChainResult> {
  select: (...args: unknown[]) => SupabaseChainMock;
  eq: (...args: unknown[]) => SupabaseChainMock;
  order: (...args: unknown[]) => SupabaseChainMock;
  throwOnError: (...args: unknown[]) => SupabaseChainMock;
}

function makeChainable(result: ChainResult): SupabaseChainMock {
  const chain: SupabaseChainMock = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    throwOnError: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

vi.mock("../../supabaseClient", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from "../../supabaseClient";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const FOOD_AND_DINING_BUDGET_ROW = {
  id: 19,
  amount: "250.00",
  month: 9,
  year: 2026,
  category_id: 31,
  categories: { id: 31, name: "Food And Dining" },
};

describe("useBudgetsForPeriod (real data-access layer, Supabase client mocked only)", () => {
  afterEach(() => vi.clearAllMocks());

  it("a same-category expense contributes to that budget's real spend (the reported bug, now fixed)", async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChainable({ data: [FOOD_AND_DINING_BUDGET_ROW], error: null }) as unknown as ReturnType<typeof supabase.from>
    );
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ category_id: 31, spent: "25.00" }], error: null } as never);

    const { result } = renderHook(() => useBudgetsForPeriod("u1", 2026, 9), { wrapper });

    await waitFor(() => expect(result.current.budgets).toHaveLength(1));
    const [budget] = result.current.budgets;
    expect(budget.spent).toBe(25);
    expect(budget.remaining).toBe(225);
    expect(budget.displayPercent).toBe(10);
    expect(budget.actualPercent).toBe(10);
    expect(budget.status).toBe("normal");
  });

  it("requests budgets_progress with the exact requested year/month", async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChainable({ data: [FOOD_AND_DINING_BUDGET_ROW], error: null }) as unknown as ReturnType<typeof supabase.from>
    );
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    renderHook(() => useBudgetsForPeriod("u1", 2026, 9), { wrapper });

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("budgets_progress", { p_year: 2026, p_month: 9 }));
  });

  it("a spend row for a DIFFERENT category_id does not contribute to this budget", async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChainable({ data: [FOOD_AND_DINING_BUDGET_ROW], error: null }) as unknown as ReturnType<typeof supabase.from>
    );
    // category_id 99 has no matching budget in this period.
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ category_id: 99, spent: "40.00" }], error: null } as never);

    const { result } = renderHook(() => useBudgetsForPeriod("u1", 2026, 9), { wrapper });

    await waitFor(() => expect(result.current.budgets).toHaveLength(1));
    expect(result.current.budgets[0].spent).toBe(0);
  });

  it("a budget for a different period (no matching spend row from the server) shows real zero spend, not the bug's silent zero", async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChainable({ data: [{ ...FOOD_AND_DINING_BUDGET_ROW, month: 10 }], error: null }) as unknown as ReturnType<
        typeof supabase.from
      >
    );
    // September's spend row never applies to an October budget request.
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    const { result } = renderHook(() => useBudgetsForPeriod("u1", 2026, 10), { wrapper });

    await waitFor(() => expect(result.current.budgets).toHaveLength(1));
    expect(result.current.budgets[0].spent).toBe(0);
    expect(result.current.budgets[0].month).toBe(10);
  });

  it("a hard reload (fresh QueryClient, no pre-existing cache) still produces the correct spend -- this was never a caching bug", async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeChainable({ data: [FOOD_AND_DINING_BUDGET_ROW], error: null }) as unknown as ReturnType<typeof supabase.from>
    );
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ category_id: 31, spent: "25.00" }], error: null } as never);

    // A brand-new QueryClient per render == the "hard refresh" case: no
    // stale/cached query state could be masking (or causing) the bug.
    const freshWrapper = ({ children }: { children: ReactNode }) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    };

    const { result } = renderHook(() => useBudgetsForPeriod("u1", 2026, 9), { wrapper: freshWrapper });
    await waitFor(() => expect(result.current.budgets[0]?.spent).toBe(25));
  });
});
