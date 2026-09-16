import type { ReactNode } from "react";
import { useFriendsState } from "./useFriendsState";
import { FriendsContext } from "./friendsStore";

/**
 * Mounted exactly once, in AppLayout.tsx (alongside FormatPreferencesProvider),
 * so the Friends page AND the nav icon badges (AppNav.tsx/MobileHeader.tsx)
 * all read and mutate the SAME Friends state -- accepting/declining/removing
 * a friend on the Friends page immediately updates the nav badge, and vice
 * versa would once a real backend query replaces useFriendsState()'s body.
 * This is exactly the seam described in useFriendsState.ts's doc comment:
 * swapping that hook's internals for real Supabase-backed queries/mutations
 * later requires no change here or in any consumer.
 */
export function FriendsProvider({ children }: { children: ReactNode }) {
  const state = useFriendsState();
  return <FriendsContext.Provider value={state}>{children}</FriendsContext.Provider>;
}
