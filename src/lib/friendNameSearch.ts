/**
 * Local, client-side prefix matching for the Split Expenses friend picker
 * (FriendAutocomplete) -- deliberately NOT the same thing as Friends'
 * server-side search_nexali_users() (substring-of-full-name, exact-email
 * only, bounded to 20 rows, debounced network call). This picker's list is
 * already fully loaded (the user's real accepted friends, via
 * useListFriends()'s cache) and small, so filtering happens instantly,
 * locally, on every keystroke, with no network round-trip.
 *
 * Matching is PREFIX matching against each whitespace-separated token in
 * the full name (first name, last name, middle name...), not arbitrary
 * substring matching -- "guy" must not match "Nguyen" merely because it
 * appears mid-word. Case-insensitive and whitespace-trimmed.
 */
export function matchesFriendNameQuery(fullName: string, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  return fullName
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .some((token) => token.startsWith(query));
}

export function filterFriendsByNameQuery<T extends { fullName: string }>(friends: T[], rawQuery: string): T[] {
  return friends.filter((friend) => matchesFriendNameQuery(friend.fullName, rawQuery));
}
