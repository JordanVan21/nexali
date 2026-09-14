import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useUpdateProfile } from "./useProfile";
import { qk } from "../querykeys";

vi.mock("../../supabaseClient", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../../supabaseClient";

const USER_ID = "u1";

function mockUpdateSuccess() {
  vi.mocked(supabase.from).mockReturnValue({
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  } as unknown as ReturnType<typeof supabase.from>);
}

function renderWithSpy() {
  let client!: QueryClient;
  function Wrapper({ children }: { children: ReactNode }) {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, getClient: () => client };
}

/**
 * Regression coverage for Backend Part 6's timezone-invalidation rule:
 * changing profiles.timezone changes real financial-period semantics, so
 * every timezone-dependent server aggregate must be invalidated/refetched
 * -- but changing a purely DISPLAY preference (currency/date_format/
 * number_format) must NOT force those same aggregates to refetch, since
 * the underlying numbers haven't changed. Verified against a real
 * QueryClient (spied invalidateQueries), not just by reading the source.
 */
describe("useUpdateProfile cache invalidation", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates every timezone-dependent aggregate cache when timezone changes", async () => {
    mockUpdateSuccess();
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useUpdateProfile(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate({ timezone: "America/New_York" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);

    expect(invalidatedKeys).toContainEqual(qk.profile(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.dashboardSummary(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.reportsSummaryRoot(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.budgetsProgressRoot(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.activitySummaryRoot(USER_ID));
  });

  it("does NOT invalidate the all-time, timezone-independent category-counts cache on a timezone change", async () => {
    mockUpdateSuccess();
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useUpdateProfile(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate({ timezone: "America/New_York" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(invalidatedKeys).not.toContainEqual(qk.categoryCounts(USER_ID));
  });

  it("does NOT invalidate any financial aggregate when only currency changes", async () => {
    mockUpdateSuccess();
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useUpdateProfile(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate({ currency: "EUR" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(1));
    // Only the profile cache itself refreshes -- no aggregate refetch for a
    // purely display-level preference change.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: qk.profile(USER_ID) });
  });

  it("does NOT invalidate any financial aggregate when only date_format/number_format change", async () => {
    mockUpdateSuccess();
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useUpdateProfile(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate({ date_format: "dmy", number_format: "european" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(1));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: qk.profile(USER_ID) });
  });

  it("invalidates aggregates when timezone changes ALONGSIDE currency/date/number in the same save", async () => {
    mockUpdateSuccess();
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useUpdateProfile(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate({ timezone: "UTC", currency: "GBP", date_format: "ymd", number_format: "space" });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(invalidatedKeys).toContainEqual(qk.dashboardSummary(USER_ID));
  });
});
