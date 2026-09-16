import { useContext } from "react";
import { FriendsContext } from "./friendsStore";
import type { FriendsState } from "./useFriendsState";

/**
 * Safe empty state for a component rendered without FriendsProvider --
 * used only by isolated unit tests that mount a single shell component
 * (e.g. AppNav) on its own; every real authenticated page renders under
 * AppLayout's one shared provider instance. Actions are no-ops rather than
 * throwing, so a stray click in such a test fails loudly via an assertion
 * mismatch, not a runtime crash.
 */
const FALLBACK: FriendsState = {
  query: "",
  setQuery: () => {},
  searchResults: [],
  friends: [],
  incomingRequests: [],
  pendingUserId: null,
  actionError: null,
  sendRequest: async () => {},
  acceptRequest: async () => {},
  declineRequest: async () => {},
  removeFriend: async () => {},
};

/** The shared Friends state -- see FriendsProvider.tsx for where it's mounted. */
export function useFriends(): FriendsState {
  return useContext(FriendsContext) ?? FALLBACK;
}
