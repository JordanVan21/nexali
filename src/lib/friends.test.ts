import { describe, it, expect } from "vitest";
import { MIN_SEARCH_QUERY_LENGTH, isExactEmailMatch, matchesSearchQuery, searchUsers, toSplitParticipant, type NexaliUserPreview } from "./friends";

function user(overrides: Partial<NexaliUserPreview> = {}): NexaliUserPreview {
  return {
    id: "u1",
    fullName: "Alex Nguyen",
    email: "alex.nguyen@example.com",
    avatarUrl: null,
    status: "none",
    ...overrides,
  };
}

describe("matchesSearchQuery", () => {
  it("matches by full name, case-insensitively", () => {
    expect(matchesSearchQuery(user(), "alex")).toBe(true);
    expect(matchesSearchQuery(user(), "ALEX")).toBe(true);
    expect(matchesSearchQuery(user(), "Nguyen")).toBe(true);
  });

  it("matches by email, case-insensitively", () => {
    expect(matchesSearchQuery(user(), "ALEX.NGUYEN@EXAMPLE.COM")).toBe(true);
    expect(matchesSearchQuery(user(), "example.com")).toBe(true);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(matchesSearchQuery(user(), "   alex   ")).toBe(true);
  });

  it("does not match an unrelated query", () => {
    expect(matchesSearchQuery(user(), "sarah")).toBe(false);
  });

  it("never matches an empty/whitespace-only query", () => {
    expect(matchesSearchQuery(user(), "")).toBe(false);
    expect(matchesSearchQuery(user(), "   ")).toBe(false);
  });
});

describe("searchUsers", () => {
  const users = [
    user({ id: "1", fullName: "Alex Nguyen", email: "alex.nguyen@example.com" }),
    user({ id: "2", fullName: "Sarah Tran", email: "sarah.tran@example.com" }),
    user({ id: "3", fullName: "Jordan Lee", email: "jordan.lee@example.com" }),
  ];

  it(`returns nothing below ${MIN_SEARCH_QUERY_LENGTH} characters`, () => {
    expect(searchUsers(users, "a")).toEqual([]);
    expect(searchUsers(users, "")).toEqual([]);
  });

  it("returns matches at/above the minimum length", () => {
    expect(searchUsers(users, "al").map((u) => u.id)).toEqual(["1"]);
  });

  it("returns an empty array for no matches", () => {
    expect(searchUsers(users, "zzz-nobody")).toEqual([]);
  });

  it("returns every user whose name or email matches, not just the first", () => {
    const withDup = [...users, user({ id: "4", fullName: "Alexandra Kim", email: "akim@example.com" })];
    expect(searchUsers(withDup, "alex").map((u) => u.id)).toEqual(["1", "4"]);
  });
});

describe("isExactEmailMatch", () => {
  const email = "alex.nguyen@example.com";

  it("is true for an exact match", () => {
    expect(isExactEmailMatch("alex.nguyen@example.com", email)).toBe(true);
  });

  it("is true case-insensitively", () => {
    expect(isExactEmailMatch("ALEX.NGUYEN@EXAMPLE.COM", email)).toBe(true);
  });

  it("is true with surrounding whitespace on the query", () => {
    expect(isExactEmailMatch("  alex.nguyen@example.com  ", email)).toBe(true);
  });

  it("is false for a partial name", () => {
    expect(isExactEmailMatch("alex", email)).toBe(false);
  });

  it("is false for a partial email fragment (local part only)", () => {
    expect(isExactEmailMatch("alex.nguyen@", email)).toBe(false);
  });

  it("is false for a partial email fragment (domain only)", () => {
    expect(isExactEmailMatch("example.com", email)).toBe(false);
  });

  it("is false for a name fragment that also happens to be an email substring", () => {
    expect(isExactEmailMatch("nguyen", email)).toBe(false);
  });

  it("is false for an empty query", () => {
    expect(isExactEmailMatch("", email)).toBe(false);
  });

  it("is false for a different user's exact email", () => {
    expect(isExactEmailMatch("sarah.tran@example.com", email)).toBe(false);
  });
});

describe("toSplitParticipant (Split Expenses future integration)", () => {
  it("maps id and full name onto a Split Expenses Participant shape", () => {
    expect(toSplitParticipant(user({ id: "u-99", fullName: "Sarah Tran" }))).toEqual({ id: "u-99", name: "Sarah Tran" });
  });
});
