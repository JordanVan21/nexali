import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend,
  useSearchNexaliUsers,
  useSendFriendRequest,
} from "./useFriendsQueries";
import { qk } from "../querykeys";

vi.mock("../../lib/friendsData", () => ({
  searchNexaliUsers: vi.fn(),
  listFriends: vi.fn(),
  listIncomingFriendRequests: vi.fn(),
  getIncomingFriendRequestCount: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  declineFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
}));

import {
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  searchNexaliUsers,
  sendFriendRequest,
} from "../../lib/friendsData";

const USER_ID = "u1";

function renderWithSpy() {
  let client!: QueryClient;
  function Wrapper({ children }: { children: ReactNode }) {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, getClient: () => client };
}

describe("useSearchNexaliUsers", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("does not query below the 2-character minimum, even after the debounce window", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(searchNexaliUsers).mockResolvedValue([]);
    const { Wrapper } = renderWithSpy();
    renderHook(() => useSearchNexaliUsers(USER_ID, "a"), { wrapper: Wrapper });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(searchNexaliUsers).not.toHaveBeenCalled();
  });

  it("debounces rapid keystrokes into a single query call for the final value", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(searchNexaliUsers).mockResolvedValue([]);
    const { Wrapper } = renderWithSpy();
    // Start below the minimum so mount itself fires no query -- isolates
    // the debounce assertion from useDebouncedValue's immediate-initial-value
    // behavior (its useState(value) means the very first value is never
    // delayed, only subsequent changes are).
    const { rerender } = renderHook(({ q }: { q: string }) => useSearchNexaliUsers(USER_ID, q), {
      wrapper: Wrapper,
      initialProps: { q: "" },
    });

    rerender({ q: "al" });
    rerender({ q: "ale" });
    rerender({ q: "alex" });

    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(searchNexaliUsers).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(searchNexaliUsers).toHaveBeenCalledTimes(1);
    expect(searchNexaliUsers).toHaveBeenCalledWith("alex");
  });

  it("does not query at all without a signed-in user id", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = renderWithSpy();
    renderHook(() => useSearchNexaliUsers(undefined, "alex"), { wrapper: Wrapper });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(searchNexaliUsers).not.toHaveBeenCalled();
  });
});

describe("useSendFriendRequest invalidation", () => {
  afterEach(() => vi.clearAllMocks());

  it("invalidates only the search cache root, never friends list/incoming/count/notifications", async () => {
    vi.mocked(sendFriendRequest).mockResolvedValue("req-1");
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useSendFriendRequest(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate("recipient-1");

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(1));
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).toContainEqual(qk.friendsSearchRoot(USER_ID));
    expect(keys).not.toContainEqual(qk.friendsList(USER_ID));
    expect(keys).not.toContainEqual(qk.friendsIncoming(USER_ID));
    expect(keys).not.toContainEqual(qk.friendsIncomingCount(USER_ID));
    expect(keys).not.toContainEqual(qk.notificationsRoot(USER_ID));
  });
});

describe("useAcceptFriendRequest invalidation", () => {
  afterEach(() => vi.clearAllMocks());

  it("invalidates friends list, incoming, incoming count, search root, notifications feed and unread count", async () => {
    vi.mocked(acceptFriendRequest).mockResolvedValue(undefined);
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useAcceptFriendRequest(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate("req-1");

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(6));
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).toContainEqual(qk.friendsList(USER_ID));
    expect(keys).toContainEqual(qk.friendsIncoming(USER_ID));
    expect(keys).toContainEqual(qk.friendsIncomingCount(USER_ID));
    expect(keys).toContainEqual(qk.friendsSearchRoot(USER_ID));
    expect(keys).toContainEqual(qk.notificationsRoot(USER_ID));
    expect(keys).toContainEqual(qk.notificationsUnreadCount(USER_ID));
  });

  it("never touches Dashboard/Reports/Budgets/Transactions caches", async () => {
    vi.mocked(acceptFriendRequest).mockResolvedValue(undefined);
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useAcceptFriendRequest(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate("req-1");

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).not.toContainEqual(qk.dashboardSummary(USER_ID));
  });
});

describe("useDeclineFriendRequest invalidation", () => {
  afterEach(() => vi.clearAllMocks());

  it("invalidates the same set as accept, minus the friends list (a decline never creates a friendship)", async () => {
    vi.mocked(declineFriendRequest).mockResolvedValue(undefined);
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useDeclineFriendRequest(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate("req-1");

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(5));
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).not.toContainEqual(qk.friendsList(USER_ID));
    expect(keys).toContainEqual(qk.friendsIncoming(USER_ID));
    expect(keys).toContainEqual(qk.friendsIncomingCount(USER_ID));
    expect(keys).toContainEqual(qk.friendsSearchRoot(USER_ID));
    expect(keys).toContainEqual(qk.notificationsRoot(USER_ID));
    expect(keys).toContainEqual(qk.notificationsUnreadCount(USER_ID));
  });
});

describe("useRemoveFriend invalidation", () => {
  afterEach(() => vi.clearAllMocks());

  it("invalidates only the friends list and search root -- never notifications or incoming requests", async () => {
    vi.mocked(removeFriend).mockResolvedValue(undefined);
    const { Wrapper, getClient } = renderWithSpy();
    const { result } = renderHook(() => useRemoveFriend(USER_ID), { wrapper: Wrapper });
    const invalidateSpy = vi.spyOn(getClient(), "invalidateQueries");

    result.current.mutate("friend-1");

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(2));
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).toContainEqual(qk.friendsList(USER_ID));
    expect(keys).toContainEqual(qk.friendsSearchRoot(USER_ID));
    expect(keys).not.toContainEqual(qk.friendsIncoming(USER_ID));
    expect(keys).not.toContainEqual(qk.friendsIncomingCount(USER_ID));
    expect(keys).not.toContainEqual(qk.notificationsRoot(USER_ID));
  });
});
