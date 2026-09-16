import { createContext } from "react";
import type { FriendsState } from "./useFriendsState";

/**
 * No default value -- unlike FormatPreferencesContext (whose consumer hook
 * falls back to harmless display defaults), a missing FriendsProvider has
 * no safe fallback: its actions are the real interaction surface (send/
 * accept/decline/remove), not display-only formatting. useFriends.ts's
 * fallback exists only to keep isolated component tests (nav icons
 * rendered without the full app shell) from crashing -- every real
 * authenticated route renders under AppLayout's single provider instance.
 */
export const FriendsContext = createContext<FriendsState | null>(null);
