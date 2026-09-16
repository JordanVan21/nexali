import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "../querykeys";
import { useDebouncedValue } from "../../shared/useDebouncedValue";
import { MIN_SEARCH_QUERY_LENGTH } from "../../lib/friends";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getIncomingFriendRequestCount,
  listFriends,
  listIncomingFriendRequests,
  removeFriend,
  searchNexaliUsers,
  sendFriendRequest,
} from "../../lib/friendsData";

const SEARCH_DEBOUNCE_MS = 300;

/** Debounces `rawQuery` (matching TransactionFilterBar's existing search-debounce convention) before querying, and never queries below MIN_SEARCH_QUERY_LENGTH. */
export function useSearchNexaliUsers(userId: string | undefined, rawQuery: string) {
  const debouncedQuery = useDebouncedValue(rawQuery, SEARCH_DEBOUNCE_MS);
  const trimmed = debouncedQuery.trim();
  const enabled = !!userId && trimmed.length >= MIN_SEARCH_QUERY_LENGTH;

  return useQuery({
    queryKey: userId ? qk.friendsSearch(userId, trimmed) : ["friendsSearch", "disabled"],
    queryFn: () => searchNexaliUsers(trimmed),
    enabled,
    staleTime: 30_000,
  });
}

export function useListFriends(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? qk.friendsList(userId) : ["friendsList", "disabled"],
    queryFn: () => listFriends(),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useListIncomingFriendRequests(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? qk.friendsIncoming(userId) : ["friendsIncoming", "disabled"],
    queryFn: () => listIncomingFriendRequests(),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** The Friends badge's real data source -- independent of the Notifications unread count (see docs/BACKEND_AUDIT_REPORT.md's Friends entry for why the two can legitimately disagree). */
export function useIncomingFriendRequestCount(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? qk.friendsIncomingCount(userId) : ["friendsIncomingCount", "disabled"],
    queryFn: () => getIncomingFriendRequestCount(),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** Sending a request only ever changes search-result status (and, on the recipient's side, a notification/badge this session can't see yet) -- so only the search cache is invalidated, never friends list/incoming/count. */
export function useSendFriendRequest(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recipientId: string) => sendFriendRequest(recipientId),
    onSuccess: async () => {
      if (!userId) return;
      await qc.invalidateQueries({ queryKey: qk.friendsSearchRoot(userId) });
    },
  });
}

/** Accepting affects nearly everything: the friends list gains a member, the incoming list/count lose one, any cached search result for that person should flip to "friends", and the resolved notification changes both the feed and the unread count. */
export function useAcceptFriendRequest(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => acceptFriendRequest(requestId),
    onSuccess: async () => {
      if (!userId) return;
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.friendsList(userId) }),
        qc.invalidateQueries({ queryKey: qk.friendsIncoming(userId) }),
        qc.invalidateQueries({ queryKey: qk.friendsIncomingCount(userId) }),
        qc.invalidateQueries({ queryKey: qk.friendsSearchRoot(userId) }),
        qc.invalidateQueries({ queryKey: qk.notificationsRoot(userId) }),
        qc.invalidateQueries({ queryKey: qk.notificationsUnreadCount(userId) }),
      ]);
    },
  });
}

/** Same invalidation shape as accept, minus friendsList (a decline never creates a friendship). */
export function useDeclineFriendRequest(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => declineFriendRequest(requestId),
    onSuccess: async () => {
      if (!userId) return;
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.friendsIncoming(userId) }),
        qc.invalidateQueries({ queryKey: qk.friendsIncomingCount(userId) }),
        qc.invalidateQueries({ queryKey: qk.friendsSearchRoot(userId) }),
        qc.invalidateQueries({ queryKey: qk.notificationsRoot(userId) }),
        qc.invalidateQueries({ queryKey: qk.notificationsUnreadCount(userId) }),
      ]);
    },
  });
}

/** Removing only affects the friends list and how that person now appears in search -- never Notifications (no notification is created/changed by a removal) and never Dashboard/Reports/Budgets/Transactions. */
export function useRemoveFriend(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendUserId: string) => removeFriend(friendUserId),
    onSuccess: async () => {
      if (!userId) return;
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.friendsList(userId) }),
        qc.invalidateQueries({ queryKey: qk.friendsSearchRoot(userId) }),
      ]);
    },
  });
}
