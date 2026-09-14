import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSaveTransaction, useDeleteTransaction } from "./useTransactions";
import { qk } from "../querykeys";

vi.mock("../../lib/transactions", () => ({
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  upsertTransaction: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("../../lib/categories", () => ({
  resolveCategoryId: vi.fn().mockResolvedValue(1),
}));

const USER_ID = "u1";

/**
 * Regression coverage for the real stale-cache bug found during Backend
 * Part 4: once Dashboard/Reports/Budgets stopped sharing the old unbounded
 * transactions cache, a transaction mutation silently stopped refreshing
 * their summaries unless invalidateRelatedQueries was updated to target
 * the new server-aggregate query keys explicitly. Backend Part 5 adds two
 * more such caches (category counts, activity summary) -- this file
 * verifies every one of them is actually invalidated after a real
 * create/edit/delete, using a real QueryClient rather than a mocked hook.
 */
function renderWithSpy() {
  let client!: QueryClient;
  function Wrapper({ children }: { children: ReactNode }) {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, getClient: () => client };
}

describe("useSaveTransaction / useDeleteTransaction cache invalidation", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates every server-aggregate cache after a successful save", async () => {
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useSaveTransaction(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    await result.current.mutateAsync({
      name: "Groceries",
      type: "expense",
      amount: 42,
      merchant: null,
      note: null,
      occurredAt: "2024-03-05T12:00:00.000Z",
    });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);

    expect(invalidatedKeys).toContainEqual(qk.txRoot(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.dashboardSummary(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.reportsSummaryRoot(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.budgetsProgressRoot(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.categoryCounts(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.activitySummaryRoot(USER_ID));
  });

  it("invalidates every server-aggregate cache after a successful delete", async () => {
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useDeleteTransaction(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    await result.current.mutateAsync(7);

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);

    expect(invalidatedKeys).toContainEqual(qk.categoryCounts(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.activitySummaryRoot(USER_ID));
  });

  it("still invalidates on a failed save (onSettled runs regardless of outcome)", async () => {
    const { upsertTransaction } = await import("../../lib/transactions");
    vi.mocked(upsertTransaction).mockRejectedValueOnce(new Error("db error"));

    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useSaveTransaction(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    await expect(
      result.current.mutateAsync({
        name: "Groceries",
        type: "expense",
        amount: 42,
        merchant: null,
        note: null,
        occurredAt: "2024-03-05T12:00:00.000Z",
      })
    ).rejects.toThrow();

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(invalidatedKeys).toContainEqual(qk.activitySummaryRoot(USER_ID));
  });
});
