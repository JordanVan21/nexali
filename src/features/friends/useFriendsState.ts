import { useCallback, useMemo, useState } from "react";
import { searchUsers, type FriendStatus, type NexaliUserPreview } from "../../lib/friends";

/**
 * MOCK Nexali user directory -- frontend-only demo data for visual/
 * interaction development, never a real user list. A real backend must
 * NEVER expose `auth.users` (or any full user table) to the client like
 * this; a real search returns only a small, bounded, relevance-ranked
 * result set for the caller's actual query (see lib/friends.ts's
 * searchUsers doc comment). The mix of statuses below (friends/pending/
 * none) exists specifically so every visual state in this Part's spec is
 * reachable without needing a real backend. Deliberately excludes any
 * "current user" entry -- the future backend must exclude auth.uid() from
 * its own search results the same way (see lib/friends.ts).
 */
const MOCK_USERS: NexaliUserPreview[] = [
  { id: "u-alex", fullName: "Alex Nguyen", email: "alex.nguyen@example.com", avatarUrl: null, status: "friends" },
  { id: "u-sarah", fullName: "Sarah Tran", email: "sarah.tran@example.com", avatarUrl: null, status: "friends" },
  { id: "u-jordan", fullName: "Jordan Lee", email: "jordan.lee@example.com", avatarUrl: null, status: "none" },
  { id: "u-priya", fullName: "Priya Patel", email: "priya.patel@example.com", avatarUrl: null, status: "outgoing_pending" },
  { id: "u-marcus", fullName: "Marcus Chen", email: "marcus.chen@example.com", avatarUrl: null, status: "incoming_pending" },
  { id: "u-taylor", fullName: "Taylor Brooks", email: "taylor.brooks@example.com", avatarUrl: null, status: "none" },
];

/**
 * All Friends frontend state in one place -- nothing here is persisted to
 * Supabase (see lib/friends.ts's module doc). Every mutating action is
 * `async` and wrapped in try/catch even though today's implementation is
 * purely synchronous local state: this is the exact shape a real
 * Supabase-backed version of these actions will have (mutate, await,
 * surface a real error), so swapping the body later doesn't require
 * touching any caller. No artificial delay is added (per the task's
 * explicit "do not add fake delays" instruction) -- `pendingUserId` exists
 * as real plumbing for a future async call, even though it is only ever
 * transiently true within the current synchronous tick today.
 */
export function useFriendsState() {
  const [users, setUsers] = useState<NexaliUserPreview[]>(MOCK_USERS);
  const [query, setQuery] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const searchResults = useMemo(() => searchUsers(users, query), [users, query]);
  const friends = useMemo(() => users.filter((u) => u.status === "friends"), [users]);
  const incomingRequests = useMemo(() => users.filter((u) => u.status === "incoming_pending"), [users]);

  const transition = useCallback(async (userId: string, from: FriendStatus, to: FriendStatus, failureMessage: string) => {
    setActionError(null);
    setPendingUserId(userId);
    try {
      setUsers((list) => list.map((u) => (u.id === userId && u.status === from ? { ...u, status: to } : u)));
    } catch {
      // Unreachable today (no real async call yet) -- kept so a future
      // real mutation's rejection has somewhere real to land.
      setActionError(failureMessage);
    } finally {
      setPendingUserId(null);
    }
  }, []);

  /** FUTURE: await supabase.rpc("send_friend_request", { p_recipient_id: userId }). Never sends a real request today -- see the module doc. */
  const sendRequest = useCallback(
    (userId: string) => transition(userId, "none", "outgoing_pending", "Couldn't send friend request."),
    [transition]
  );

  /** FUTURE: await supabase.rpc("accept_friend_request", ...) + a real notification dismissal. */
  const acceptRequest = useCallback(
    (userId: string) => transition(userId, "incoming_pending", "friends", "Couldn't update friend request."),
    [transition]
  );

  /** FUTURE: await supabase.rpc("decline_friend_request", ...). */
  const declineRequest = useCallback(
    (userId: string) => transition(userId, "incoming_pending", "none", "Couldn't update friend request."),
    [transition]
  );

  /** FUTURE: await supabase.rpc("remove_friend", ...). */
  const removeFriend = useCallback(
    (userId: string) => transition(userId, "friends", "none", "Couldn't remove friend."),
    [transition]
  );

  return {
    query,
    setQuery,
    searchResults,
    friends,
    incomingRequests,
    pendingUserId,
    actionError,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
  };
}

export type FriendsState = ReturnType<typeof useFriendsState>;
