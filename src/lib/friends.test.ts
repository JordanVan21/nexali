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
 */
describe("toSplitParticipant (Split Expenses future integration)", () => {
  it("maps id and full name onto a Split Expenses Participant shape", () => {
    expect(toSplitParticipant(user({ id: "u-99", fullName: "Sarah Tran" }))).toEqual({ id: "u-99", name: "Sarah Tran" });
  });

  it("does not depend on email or avatar being present", () => {
    expect(toSplitParticipant(user({ id: "u-1", fullName: "Jordan Lee", email: null, avatarUrl: null }))).toEqual({
      id: "u-1",
      name: "Jordan Lee",
    });
  });
});
