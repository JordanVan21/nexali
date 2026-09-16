import { describe, it, expect } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useFriendsState } from "./useFriendsState";

describe("useFriendsState", () => {
  it("seeds a real mixed-status mock directory covering every FriendStatus", () => {
    const { result } = renderHook(() => useFriendsState());

    expect(result.current.friends.map((u) => u.fullName)).toEqual(expect.arrayContaining(["Alex Nguyen", "Sarah Tran"]));
    expect(result.current.incomingRequests.map((u) => u.fullName)).toEqual(["Marcus Chen"]);
  });

  it("search reflects the real directory and respects the minimum query length", () => {
    const { result } = renderHook(() => useFriendsState());

    act(() => result.current.setQuery("a"));
    expect(result.current.searchResults).toEqual([]);

    act(() => result.current.setQuery("Jordan"));
    expect(result.current.searchResults.map((u) => u.fullName)).toEqual(["Jordan Lee"]);
  });

  it("sendRequest transitions a 'none' user to 'outgoing_pending' only", async () => {
    const { result } = renderHook(() => useFriendsState());
    act(() => result.current.setQuery("Jordan"));

    await act(async () => result.current.sendRequest("u-jordan"));

    await waitFor(() => expect(result.current.searchResults[0].status).toBe("outgoing_pending"));
  });

  it("sendRequest is a no-op for a user who is already a friend (no duplicate/incorrect transition)", async () => {
    const { result } = renderHook(() => useFriendsState());
    const before = result.current.friends.find((u) => u.id === "u-alex")!;

    await act(async () => result.current.sendRequest("u-alex"));

    expect(result.current.friends.find((u) => u.id === "u-alex")).toEqual(before);
  });

  it("acceptRequest moves the sender from incomingRequests into friends", async () => {
    const { result } = renderHook(() => useFriendsState());
    expect(result.current.incomingRequests).toHaveLength(1);

    await act(async () => result.current.acceptRequest("u-marcus"));

    await waitFor(() => {
      expect(result.current.incomingRequests).toHaveLength(0);
      expect(result.current.friends.map((u) => u.id)).toContain("u-marcus");
    });
  });

  it("declineRequest removes the request without adding a friend", async () => {
    const { result } = renderHook(() => useFriendsState());

    await act(async () => result.current.declineRequest("u-marcus"));

    await waitFor(() => {
      expect(result.current.incomingRequests).toHaveLength(0);
      expect(result.current.friends.map((u) => u.id)).not.toContain("u-marcus");
    });
  });

  it("removeFriend transitions a friend back to 'none'", async () => {
    const { result } = renderHook(() => useFriendsState());
    expect(result.current.friends.map((u) => u.id)).toContain("u-alex");

    await act(async () => result.current.removeFriend("u-alex"));

    await waitFor(() => expect(result.current.friends.map((u) => u.id)).not.toContain("u-alex"));

    act(() => result.current.setQuery("Alex Nguyen"));
    expect(result.current.searchResults[0].status).toBe("none");
  });

  it("pendingUserId and actionError exist as real state (future-async plumbing) and start idle", () => {
    const { result } = renderHook(() => useFriendsState());
    expect(result.current.pendingUserId).toBeNull();
    expect(result.current.actionError).toBeNull();
  });
});
