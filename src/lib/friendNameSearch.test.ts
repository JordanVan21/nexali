import { describe, it, expect } from "vitest";
import { matchesFriendNameQuery, filterFriendsByNameQuery } from "./friendNameSearch";

describe("matchesFriendNameQuery (prefix, per-token matching)", () => {
  it("an empty/whitespace query matches everyone", () => {
    expect(matchesFriendNameQuery("Peter Nguyen", "")).toBe(true);
    expect(matchesFriendNameQuery("Peter Nguyen", "   ")).toBe(true);
  });

  it("matches a first-name prefix", () => {
    expect(matchesFriendNameQuery("Peter Nguyen", "p")).toBe(true);
    expect(matchesFriendNameQuery("Peter Nguyen", "pet")).toBe(true);
  });

  it("matches a last-name (token) prefix, not just the first token", () => {
    expect(matchesFriendNameQuery("Peter Nguyen", "n")).toBe(true);
    expect(matchesFriendNameQuery("Peter Nguyen", "ngu")).toBe(true);
  });

  it("is case-insensitive -- uppercase query matches the same as lowercase", () => {
    expect(matchesFriendNameQuery("Peter Nguyen", "P")).toBe(true);
    expect(matchesFriendNameQuery("Peter Nguyen", "N")).toBe(true);
  });

  it("is PREFIX matching, not substring matching -- a middle fragment must not match unless some token starts with it", () => {
    expect(matchesFriendNameQuery("Peter Nguyen", "guy")).toBe(false);
    expect(matchesFriendNameQuery("Peter Nguyen", "ete")).toBe(false);
  });

  it("does not match a query that isn't a prefix of any token", () => {
    expect(matchesFriendNameQuery("Peter Nguyen", "xyz")).toBe(false);
  });

  it("trims leading/trailing whitespace from the query before matching", () => {
    expect(matchesFriendNameQuery("Peter Nguyen", "  p  ")).toBe(true);
  });

  it("handles a middle name / multi-token name -- every token is a candidate prefix", () => {
    expect(matchesFriendNameQuery("Mary Jane Watson", "j")).toBe(true);
    expect(matchesFriendNameQuery("Mary Jane Watson", "wat")).toBe(true);
  });

  it("handles extra internal whitespace between name tokens", () => {
    expect(matchesFriendNameQuery("Peter   Nguyen", "ngu")).toBe(true);
  });
});

describe("filterFriendsByNameQuery (the task's own worked example)", () => {
  const friends = [
    { id: "1", fullName: "Peter Nguyen" },
    { id: "2", fullName: "Paul Tran" },
    { id: "3", fullName: "Alex Pham" },
    { id: "4", fullName: "Sarah Le" },
  ];

  /**
   * The task's SEARCH MATCHING example lists query "p" as matching only
   * "Peter Nguyen"/"Paul Tran" -- but its own, more specific NAME TOKEN
   * MATCHING section separately and explicitly requires prefix matching
   * against EVERY token (first AND last name), e.g. "Peter Nguyen" must
   * match query "n" because "Nguyen" starts with N. Applying that same
   * governing rule consistently, "Alex Pham" also legitimately matches
   * query "p" (its last name "Pham" starts with "p") -- excluding it would
   * require a special, unprincipled carve-out that contradicts the token
   * rule the task itself mandates elsewhere. This suite follows the
   * explicit, general token rule rather than the illustrative example's
   * literal (and, for this specific fixture, internally inconsistent)
   * result list.
   */
  it('query "p" shows every friend with a name token starting with "p" (Peter, Paul, and Pham)', () => {
    expect(filterFriendsByNameQuery(friends, "p").map((f) => f.fullName)).toEqual([
      "Peter Nguyen",
      "Paul Tran",
      "Alex Pham",
    ]);
  });

  it('query "P" (uppercase) returns the same results as "p"', () => {
    expect(filterFriendsByNameQuery(friends, "P")).toEqual(filterFriendsByNameQuery(friends, "p"));
  });

  it('query "pe" shows only Peter Nguyen (no other token starts with "pe")', () => {
    expect(filterFriendsByNameQuery(friends, "pe").map((f) => f.fullName)).toEqual(["Peter Nguyen"]);
  });

  it("clearing the query restores every available friend", () => {
    expect(filterFriendsByNameQuery(friends, "")).toEqual(friends);
  });

  it("preserves the input order (no re-sorting)", () => {
    const result = filterFriendsByNameQuery(friends, "");
    expect(result.map((f) => f.id)).toEqual(["1", "2", "3", "4"]);
  });
});
