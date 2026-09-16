import { describe, it, expect, vi, afterEach } from "vitest";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getIncomingFriendRequestCount,
  listFriends,
  listIncomingFriendRequests,
  removeFriend,
  searchNexaliUsers,
  sendFriendRequest,
} from "./friendsData";

vi.mock("../supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from "../supabaseClient";

describe("searchNexaliUsers", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls search_nexali_users with exactly the query, no client-supplied user id", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
    await searchNexaliUsers("alex");
    expect(supabase.rpc).toHaveBeenCalledWith("search_nexali_users", { p_query: "alex" });
  });

  it("maps every column, including a real null email straight through (never invented client-side)", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ user_id: "u1", full_name: "Alex Nguyen", avatar_url: null, email: null, relationship_status: "none" }],
      error: null,
    } as never);

    const [result] = await searchNexaliUsers("alex");
    expect(result).toEqual({ id: "u1", fullName: "Alex Nguyen", email: null, avatarUrl: null, status: "none" });
  });

  it("passes through a real returned email for an exact-match row", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ user_id: "u1", full_name: "Alex Nguyen", avatar_url: null, email: "alex.nguyen@example.com", relationship_status: "none" }],
      error: null,
    } as never);

    const [result] = await searchNexaliUsers("alex.nguyen@example.com");
    expect(result.email).toBe("alex.nguyen@example.com");
  });

  it("falls back to a safe display name when full_name is null", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ user_id: "u1", full_name: null, avatar_url: null, email: null, relationship_status: "none" }],
      error: null,
    } as never);
    const [result] = await searchNexaliUsers("x");
    expect(result.fullName).toBe("Nexali User");
  });

  it("throws the real Supabase/Postgres error rather than swallowing it", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "permission denied" } } as never);
    await expect(searchNexaliUsers("alex")).rejects.toBeTruthy();
  });
});

describe("listFriends", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls list_friends with no arguments (identity derived server-side)", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
    await listFriends();
    expect(supabase.rpc).toHaveBeenCalledWith("list_friends");
  });

  it("maps every friend with status always 'friends' and a real email", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ user_id: "u1", full_name: "Alex Nguyen", avatar_url: null, email: "alex.nguyen@example.com", friendship_id: "f1", friends_since: "2026-09-01T00:00:00.000Z" }],
      error: null,
    } as never);

    const [result] = await listFriends();
    expect(result).toEqual({ id: "u1", fullName: "Alex Nguyen", email: "alex.nguyen@example.com", avatarUrl: null, status: "friends" });
  });
});

describe("listIncomingFriendRequests", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls list_incoming_friend_requests with no arguments", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
    await listIncomingFriendRequests();
    expect(supabase.rpc).toHaveBeenCalledWith("list_incoming_friend_requests");
  });

  it("maps every row without ever including an email field", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ request_id: "r1", sender_user_id: "u1", sender_full_name: "Marcus Chen", sender_avatar_url: null, created_at: "2026-09-19T00:00:00.000Z" }],
      error: null,
    } as never);

    const [result] = await listIncomingFriendRequests();
    expect(result).toEqual({
      requestId: "r1",
      senderId: "u1",
      senderFullName: "Marcus Chen",
      senderAvatarUrl: null,
      createdAt: "2026-09-19T00:00:00.000Z",
    });
    expect(Object.keys(result)).not.toContain("email");
  });
});

describe("getIncomingFriendRequestCount", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls get_incoming_friend_request_count and returns the real number", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 3, error: null } as never);
    expect(await getIncomingFriendRequestCount()).toBe(3);
    expect(supabase.rpc).toHaveBeenCalledWith("get_incoming_friend_request_count");
  });

  it("returns 0 rather than null/undefined", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    expect(await getIncomingFriendRequestCount()).toBe(0);
  });
});

describe("sendFriendRequest", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls send_friend_request with only the recipient id", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: "new-request-id", error: null } as never);
    const id = await sendFriendRequest("u-recipient");
    expect(supabase.rpc).toHaveBeenCalledWith("send_friend_request", { p_recipient_id: "u-recipient" });
    expect(id).toBe("new-request-id");
  });

  it("propagates the real RPC error message (e.g. self-request/duplicate/already-friends)", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "You cannot send a friend request to yourself" } } as never);
    await expect(sendFriendRequest("u1")).rejects.toBeTruthy();
  });
});

describe("acceptFriendRequest / declineFriendRequest / removeFriend", () => {
  afterEach(() => vi.clearAllMocks());

  it("acceptFriendRequest calls accept_friend_request with only the request id", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    await acceptFriendRequest("req-1");
    expect(supabase.rpc).toHaveBeenCalledWith("accept_friend_request", { p_request_id: "req-1" });
  });

  it("declineFriendRequest calls decline_friend_request with only the request id", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    await declineFriendRequest("req-1");
    expect(supabase.rpc).toHaveBeenCalledWith("decline_friend_request", { p_request_id: "req-1" });
  });

  it("removeFriend calls remove_friend with only the friend's user id", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    await removeFriend("u-friend");
    expect(supabase.rpc).toHaveBeenCalledWith("remove_friend", { p_friend_user_id: "u-friend" });
  });

  it("all three throw the real error rather than swallowing it", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "Friend request not found" } } as never);
    await expect(acceptFriendRequest("x")).rejects.toBeTruthy();
    await expect(declineFriendRequest("x")).rejects.toBeTruthy();
    await expect(removeFriend("x")).rejects.toBeTruthy();
  });
});
