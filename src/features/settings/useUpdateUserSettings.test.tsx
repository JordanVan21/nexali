import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useUpdateUserSettings, type UpdateUserSettingsMutationVars } from "./useUpdateUserSettings";
import { qk } from "../querykeys";

vi.mock("../../supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from "../../supabaseClient";

const USER_ID = "u1";

function baseVars(overrides: Partial<UpdateUserSettingsMutationVars> = {}): UpdateUserSettingsMutationVars {
  return {
    timezone: "America/Los_Angeles",
    currency: "USD",
    dateFormat: "mdy",
    numberFormat: "standard",
    notifyApproaching: true,
    notifyExceeded: true,
    notifySummary: true,
    notifySecurity: true,
    previousTimezone: "America/Los_Angeles",
    ...overrides,
  };
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
 * Backend Part 7 atomicity fix: Settings' Save Changes now persists both
 * profiles(timezone/currency/date_format/number_format) and
 * notification_preferences (the four switches) through ONE RPC call
 * (update_user_settings), instead of two independent
 * updateProfile/updatePreferences mutations that could partially succeed.
 * This suite proves: exactly one supabase.rpc call carries all eight real
 * values with no client-supplied user id, and cache invalidation still
 * follows Backend Part 6's exact timezone-vs-display-only split.
 */
describe("useUpdateUserSettings", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls the atomic update_user_settings RPC exactly once per save, not two independent table writes", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    const { Wrapper } = renderWithSpy();
    const { result } = renderHook(() => useUpdateUserSettings(USER_ID), { wrapper: Wrapper });

    result.current.mutate(baseVars());

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1));
    expect(supabase.rpc).toHaveBeenCalledWith("update_user_settings", expect.any(Object));
  });

  it("the RPC payload carries all eight real Settings values under their exact p_ argument names", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    const { Wrapper } = renderWithSpy();
    const { result } = renderHook(() => useUpdateUserSettings(USER_ID), { wrapper: Wrapper });

    result.current.mutate(
      baseVars({ currency: "EUR", notifyExceeded: false, timezone: "America/New_York", previousTimezone: "America/Los_Angeles" })
    );

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1));
    expect(supabase.rpc).toHaveBeenCalledWith("update_user_settings", {
      p_timezone: "America/New_York",
      p_currency: "EUR",
      p_date_format: "mdy",
      p_number_format: "standard",
      p_budget_approaching: true,
      p_budget_exceeded: false,
      p_monthly_summary: true,
      p_account_security: true,
    });
  });

  it("never sends any user-id argument -- the RPC derives the caller from auth.uid() server-side", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    const { Wrapper } = renderWithSpy();
    const { result } = renderHook(() => useUpdateUserSettings(USER_ID), { wrapper: Wrapper });

    result.current.mutate(baseVars());

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1));
    const [, args] = vi.mocked(supabase.rpc).mock.calls[0];
    expect(Object.keys(args as object)).not.toContain("p_user_id");
    expect(Object.keys(args as object)).not.toContain("user_id");
  });

  it("propagates a real RPC error (e.g. a rolled-back transaction) rather than swallowing it", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "invalid currency XYZ" } } as never);
    const { Wrapper } = renderWithSpy();
    const { result } = renderHook(() => useUpdateUserSettings(USER_ID), { wrapper: Wrapper });

    result.current.mutate(baseVars());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("on success, invalidates both qk.profile and qk.notificationPreferences", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useUpdateUserSettings(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate(baseVars());

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(invalidatedKeys).toContainEqual(qk.profile(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.notificationPreferences(USER_ID));
  });

  it("invalidates every timezone-dependent financial aggregate cache when timezone actually changed", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useUpdateUserSettings(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate(baseVars({ timezone: "America/New_York", previousTimezone: "America/Los_Angeles" }));

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(invalidatedKeys).toContainEqual(qk.dashboardSummary(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.reportsSummaryRoot(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.budgetsProgressRoot(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.activitySummaryRoot(USER_ID));
  });

  it("does NOT invalidate any financial aggregate when timezone is unchanged and only currency changed", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useUpdateUserSettings(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate(baseVars({ currency: "EUR", timezone: "America/Los_Angeles", previousTimezone: "America/Los_Angeles" }));

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(2));
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(invalidatedKeys).toContainEqual(qk.profile(USER_ID));
    expect(invalidatedKeys).toContainEqual(qk.notificationPreferences(USER_ID));
    expect(invalidatedKeys).not.toContainEqual(qk.dashboardSummary(USER_ID));
    expect(invalidatedKeys).not.toContainEqual(qk.reportsSummaryRoot(USER_ID));
    expect(invalidatedKeys).not.toContainEqual(qk.budgetsProgressRoot(USER_ID));
    expect(invalidatedKeys).not.toContainEqual(qk.activitySummaryRoot(USER_ID));
  });

  it("does NOT invalidate any financial aggregate when timezone is unchanged and only a notification preference changed", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useUpdateUserSettings(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate(baseVars({ notifyExceeded: false, timezone: "America/Los_Angeles", previousTimezone: "America/Los_Angeles" }));

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(2));
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(invalidatedKeys).not.toContainEqual(qk.dashboardSummary(USER_ID));
    expect(invalidatedKeys).not.toContainEqual(qk.reportsSummaryRoot(USER_ID));
    expect(invalidatedKeys).not.toContainEqual(qk.budgetsProgressRoot(USER_ID));
    expect(invalidatedKeys).not.toContainEqual(qk.activitySummaryRoot(USER_ID));
  });
});
