import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAcceptSplitExpense, useDeclineSplitExpense, useSubmitSplitExpense } from "./useSubmitSplitExpense";
import { qk } from "../querykeys";
import type { SubmitSplitExpensePayload } from "../../lib/splitExpenses";

vi.mock("../../lib/splitExpensesData", () => ({
  submitSplitExpense: vi.fn(),
  acceptSplitExpense: vi.fn(),
  declineSplitExpense: vi.fn(),
}));

import { acceptSplitExpense, declineSplitExpense, submitSplitExpense } from "../../lib/splitExpensesData";

const USER_ID = "u1";

function renderWithSpy() {
  let client!: QueryClient;
  function Wrapper({ children }: { children: ReactNode }) {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, getClient: () => client };
}

function fixturePayload(): SubmitSplitExpensePayload {
  return {
    idempotencyKey: "key-1",
    currency: "USD",
    participants: [{ userId: USER_ID, position: 0 }],
    receipts: [],
  };
}

function fixtureResult() {
  return {
    splitId: "s1",
    status: "accepted" as const,
    currency: "USD",
    creatorTransactionCount: 1,
    participants: [],
    settlements: [],
  };
}

describe("useSubmitSplitExpense", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls submitSplitExpense with exactly the given payload", async () => {
    vi.mocked(submitSplitExpense).mockResolvedValue(fixtureResult());
    const { Wrapper } = renderWithSpy();
    const { result } = renderHook(() => useSubmitSplitExpense(USER_ID), { wrapper: Wrapper });

    result.current.mutate(fixturePayload());

    await waitFor(() => expect(submitSplitExpense).toHaveBeenCalledWith(fixturePayload()));
  });

  it("invalidates every real financial cache plus the Split namespace on success (creator transactions were created)", async () => {
    vi.mocked(submitSplitExpense).mockResolvedValue(fixtureResult());
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useSubmitSplitExpense(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate(fixturePayload());

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).toContainEqual(qk.txRoot(USER_ID));
    expect(keys).toContainEqual(qk.dashboardSummary(USER_ID));
    expect(keys).toContainEqual(qk.reportsSummaryRoot(USER_ID));
    expect(keys).toContainEqual(qk.budgetsProgressRoot(USER_ID));
    expect(keys).toContainEqual(qk.categoryCounts(USER_ID));
    expect(keys).toContainEqual(qk.activitySummaryRoot(USER_ID));
    expect(keys).toContainEqual(qk.splitRoot(USER_ID));
  });

  it("does NOT invalidate notifications -- the creator does not receive a notification for their own submission", async () => {
    vi.mocked(submitSplitExpense).mockResolvedValue(fixtureResult());
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useSubmitSplitExpense(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate(fixturePayload());

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).not.toContainEqual(qk.notificationsRoot(USER_ID));
    expect(keys).not.toContainEqual(qk.notificationsUnreadCount(USER_ID));
  });

  it("propagates a real submission error rather than swallowing it", async () => {
    vi.mocked(submitSplitExpense).mockRejectedValue(new Error("Split totals do not reconcile"));
    const { Wrapper } = renderWithSpy();
    const { result } = renderHook(() => useSubmitSplitExpense(USER_ID), { wrapper: Wrapper });

    result.current.mutate(fixturePayload());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useAcceptSplitExpense", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls acceptSplitExpense with exactly the given split id", async () => {
    vi.mocked(acceptSplitExpense).mockResolvedValue(fixtureResult());
    const { Wrapper } = renderWithSpy();
    const { result } = renderHook(() => useAcceptSplitExpense(USER_ID), { wrapper: Wrapper });

    result.current.mutate("split-1");

    await waitFor(() => expect(acceptSplitExpense).toHaveBeenCalledWith("split-1"));
  });

  it("invalidates financial caches, notifications, and Split status (accepting creates real transactions and resolves a notification)", async () => {
    vi.mocked(acceptSplitExpense).mockResolvedValue(fixtureResult());
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useAcceptSplitExpense(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate("split-1");

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).toContainEqual(qk.txRoot(USER_ID));
    expect(keys).toContainEqual(qk.dashboardSummary(USER_ID));
    expect(keys).toContainEqual(qk.notificationsRoot(USER_ID));
    expect(keys).toContainEqual(qk.notificationsUnreadCount(USER_ID));
    expect(keys).toContainEqual(qk.splitRoot(USER_ID));
  });
});

describe("useDeclineSplitExpense", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls declineSplitExpense with exactly the given split id", async () => {
    vi.mocked(declineSplitExpense).mockResolvedValue(fixtureResult());
    const { Wrapper } = renderWithSpy();
    const { result } = renderHook(() => useDeclineSplitExpense(USER_ID), { wrapper: Wrapper });

    result.current.mutate("split-1");

    await waitFor(() => expect(declineSplitExpense).toHaveBeenCalledWith("split-1"));
  });

  it("invalidates notifications and Split status only -- never financial aggregates (no transaction was created)", async () => {
    vi.mocked(declineSplitExpense).mockResolvedValue(fixtureResult());
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useDeclineSplitExpense(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate("split-1");

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).toContainEqual(qk.notificationsRoot(USER_ID));
    expect(keys).toContainEqual(qk.notificationsUnreadCount(USER_ID));
    expect(keys).toContainEqual(qk.splitRoot(USER_ID));
    expect(keys).not.toContainEqual(qk.txRoot(USER_ID));
    expect(keys).not.toContainEqual(qk.dashboardSummary(USER_ID));
    expect(keys).not.toContainEqual(qk.reportsSummaryRoot(USER_ID));
    expect(keys).not.toContainEqual(qk.budgetsProgressRoot(USER_ID));
  });
});
