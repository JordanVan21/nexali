import { describe, it, expect } from "vitest";
import { toSplitParticipant, type NexaliUserPreview } from "./friends";

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

/**
 * lib/friends.ts is now types-only plus the Split Expenses mapping helper
 * -- search matching, the exact-email rule, and the mock user directory
 * all moved server-side (Backend Part 8: search_nexali_users() and
 * friendsData.ts). See lib/friendsData.test.ts for the real data-access
 * layer's tests, and pages/Friends.test.tsx for the server-enforced email
 * privacy behavior exercised end-to-end.
 *
 * toSplitParticipant is now actually wired into Split Expenses (the real
 * Friend Autocomplete picker) -- see useSplitExpensesState.ts's
 * addFriendParticipant() and FriendAutocomplete.test.tsx.
 */
describe("toSplitParticipant (real Friends -> Split Expenses participant mapping)", () => {
  it("maps id, full name, email, and avatar onto a Split Expenses Participant, using the SAME id (never a freshly generated one)", () => {
    expect(
      toSplitParticipant(user({ id: "u-99", fullName: "Sarah Tran", email: "sarah@example.com", avatarUrl: "https://example.com/a.png" }))
    ).toEqual({ id: "u-99", name: "Sarah Tran", email: "sarah@example.com", avatarUrl: "https://example.com/a.png", isRealNexaliUser: true });
  });

  it("carries a null email/avatar through as null, never inventing a placeholder value", () => {
    expect(toSplitParticipant(user({ id: "u-1", fullName: "Jordan Lee", email: null, avatarUrl: null }))).toEqual({
      id: "u-1",
      name: "Jordan Lee",
      email: null,
      avatarUrl: null,
      isRealNexaliUser: true,
    });
  });

  it("is always marked isRealNexaliUser: true -- a real Friends account can always be validated/notified/create a transaction for by the backend", () => {
    expect(toSplitParticipant(user()).isRealNexaliUser).toBe(true);
  });
});
