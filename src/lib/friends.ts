import type { Participant } from "./splitExpenses";

/**
 * Friends -- FRONTEND ONLY types (see docs/BACKEND_AUDIT_REPORT.md's
 * Friends entry). No table, RPC, or Edge Function exists for any of this
 * yet; every value here lives in page-local React state
 * (features/friends/useFriendsState.ts) and is never sent to Supabase.
 *
 * A user relationship is exactly one of these four states -- a
 * discriminated-by-value union (not scattered boolean flags like
 * `isFriend`/`isPending`, which could contradict each other) so a
 * component can never render two conflicting states for the same person.
 */
export type FriendStatus = "none" | "outgoing_pending" | "incoming_pending" | "friends";

/**
 * A person as Friends displays them. `id` is a stable, opaque identifier
 * -- treated as an opaque string, never assumed to be a real Supabase
 * auth.users id shape, since no such lookup exists yet.
 *
 * EMAIL PRIVACY -- REQUIRED BACKEND DESIGN REVIEW: this frontend
 * deliberately displays another user's email under their name, exactly as
 * this Part's design spec asked for. Before any real backend search ships,
 * product/security must explicitly decide: (a) whether every authenticated
 * Nexali user's email may be exposed to other authenticated users at all,
 * (b) whether search should require an exact email match rather than a
 * partial one, and (c) whether email visibility should depend on
 * relationship status (e.g. hidden until a request is accepted). Do not
 * treat this frontend's display choice as that decision having been made.
 */
export interface NexaliUserPreview {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  status: FriendStatus;
}

/** Below this length, no search results are shown at all (see Friends.tsx). */
export const MIN_SEARCH_QUERY_LENGTH = 2;

/** Case-insensitive, whitespace-trimmed match against full name OR email. */
export function matchesSearchQuery(user: NexaliUserPreview, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return false;
  return user.fullName.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
}

/**
 * Real, deterministic client-side search over the (mock) user directory.
 * Returns an empty list below MIN_SEARCH_QUERY_LENGTH -- Friends.tsx uses
 * this, not an arbitrary "empty query" special case, to decide whether to
 * show the results list at all.
 *
 * FUTURE BACKEND: this same shape (a bounded, real list of
 * NexaliUserPreview) is what a real search RPC should return -- swap only
 * this function's body for a Supabase call later; do NOT search the
 * client's own local directory of "every user" (that would require
 * exposing auth.users to the client, which must never happen -- see the
 * NexaliUserPreview doc comment).
 */
export function searchUsers(users: NexaliUserPreview[], rawQuery: string): NexaliUserPreview[] {
  const q = rawQuery.trim();
  if (q.length < MIN_SEARCH_QUERY_LENGTH) return [];
  return users.filter((u) => matchesSearchQuery(u, q));
}

/**
 * Whether `query` is an EXACT match (trimmed, case-insensitive) for
 * `email` -- the one condition under which Friends search/request UI may
 * reveal a non-friend's email (see components/friends/UserRow.tsx's
 * `showEmail` prop and Friends.tsx). Deliberately NOT a substring/
 * "matched by email" check: `searchUsers()` already allows finding someone
 * by a partial email, but finding them is a different concept from being
 * shown their full email address -- a partial match only proves the
 * searcher already had a fragment, not the complete value.
 *
 * PRIVACY ARCHITECTURE -- REQUIRED BACKEND DESIGN REVIEW: this frontend
 * rule is a preview of the intended backend contract, not a security
 * boundary by itself (frontend hiding can never be one -- see below).
 * Preferred future backend response shape:
 *   - name search            -> return id, full name, avatar ONLY (no email field at all)
 *   - partial email search   -> may identify a matching account (if product policy allows), but must NOT return the complete email
 *   - exact email search     -> may return the email, since the caller already supplied the exact value themselves
 *   - accepted friend        -> email may be returned/displayed, as it already is today
 * IMPORTANT: when the real Friends backend is built, the SERVER must
 * enforce these rules (e.g. a search RPC that only ever includes an
 * `email` column in its result under the exact-match/accepted-friend
 * cases) -- never rely on the client merely choosing not to render a field
 * it already received. This frontend's `isExactEmailMatch` gate exists so
 * the UI behaves correctly today against mock data that (unrealistically)
 * always includes the email; it must not be mistaken for real access
 * control once a backend exists.
 */
export function isExactEmailMatch(query: string, email: string): boolean {
  return query.trim().toLowerCase() === email.trim().toLowerCase();
}

/**
 * Split Expenses future integration: a Friends user maps directly onto a
 * Split Expenses Participant (see lib/splitExpenses.ts) without inventing
 * a second, incompatible "person" shape. Not wired into Split Expenses in
 * this Part (no backend connection exists yet) -- this is groundwork only,
 * proving the two feature's user representations can compose cleanly once
 * Friends has real data.
 */
export function toSplitParticipant(user: NexaliUserPreview): Participant {
  return { id: user.id, name: user.fullName };
}
