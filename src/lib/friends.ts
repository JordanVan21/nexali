import type { Participant } from "./splitExpenses";

/**
 * Friends -- real, Supabase-backed types (Backend Part 8). Identity comes
 * from `auth.users`/`public.profiles` via the RPCs in
 * lib/friendsData.ts -- no duplicate user-profile table exists.
 *
 * A user relationship is exactly one of these four states -- a
 * discriminated-by-value union (not scattered boolean flags like
 * `isFriend`/`isPending`, which could contradict each other) so a
 * component can never render two conflicting states for the same person.
 * These exact string values are also what `search_nexali_users()` returns
 * as `relationship_status`.
 */
export type FriendStatus = "none" | "outgoing_pending" | "incoming_pending" | "friends";

/**
 * A person as Friends displays them.
 *
 * EMAIL PRIVACY -- now SERVER-enforced (Backend Part 8), not a frontend
 * convention: `email` is `null` for every search result except an exact
 * (trimmed, case-insensitive) email match -- `search_nexali_users()`'s SQL
 * computes this with a CASE expression, so a non-matching row's email is
 * genuinely absent from the response, not merely hidden by this
 * component tree. `list_friends()` always includes the real email (the
 * relationship is mutually accepted); `list_incoming_friend_requests()`
 * never includes it at all (a separate, narrower type -- see
 * IncomingFriendRequest below), matching the approved frontend contract:
 * incoming requests show sender name/avatar only, never email.
 */
export interface NexaliUserPreview {
  id: string;
  fullName: string;
  email: string | null;
  avatarUrl?: string | null;
  status: FriendStatus;
}

/**
 * An incoming (pending, addressed to the current user) friend request.
 * Deliberately has NO email field at all -- not "email: null", not
 * optional-and-unset -- because `list_incoming_friend_requests()` never
 * selects the sender's email in the first place (see lib/friendsData.ts).
 */
export interface IncomingFriendRequest {
  requestId: string;
  senderId: string;
  senderFullName: string;
  senderAvatarUrl: string | null;
  createdAt: string;
}

/** Below this length, no search request is sent at all (see features/friends/useFriendsQueries.ts). */
export const MIN_SEARCH_QUERY_LENGTH = 2;

/**
 * Split Expenses future integration: a Friends user maps directly onto a
 * Split Expenses Participant (see lib/splitExpenses.ts) without inventing
 * a second, incompatible "person" shape. Not wired into Split Expenses in
 * this Part (no such connection was requested) -- this is groundwork
 * only, proving the two features' user representations compose cleanly
 * now that Friends has real data.
 */
export function toSplitParticipant(user: NexaliUserPreview): Participant {
  return { id: user.id, name: user.fullName };
}
