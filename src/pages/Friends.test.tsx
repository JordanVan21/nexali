import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Friends from "./Friends";

/**
 * Friends -- FRONTEND ONLY. Every assertion here exercises the real,
 * seeded mock directory in useFriendsState.ts (Alex Nguyen/Sarah Tran:
 * friends; Jordan Lee/Taylor Brooks: none; Priya Patel: outgoing_pending;
 * Marcus Chen: incoming_pending) -- no Supabase call exists anywhere in
 * this feature to mock.
 */
async function search(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = screen.getByLabelText(/search nexali users/i);
  await user.clear(input);
  await user.type(input, query);
}

describe("Friends page", () => {
  it("renders the page heading and concise supporting copy", () => {
    renderWithProviders(<Friends />, { route: "/friends" });
    expect(screen.getByRole("heading", { name: "Friends" })).toBeInTheDocument();
    expect(screen.getByText(/find people on nexali and manage your friends/i)).toBeInTheDocument();
  });

  describe("search", () => {
    it("hides results with an empty search (search clear state)", () => {
      renderWithProviders(<Friends />, { route: "/friends" });
      expect(screen.queryByText(/no nexali users found/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/send friend request to/i)).not.toBeInTheDocument();
    });

    it("requires at least 2 characters before showing any results", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "j");
      expect(screen.queryByText("Jordan Lee")).not.toBeInTheDocument();
      expect(screen.queryByText(/no nexali users found/i)).not.toBeInTheDocument();
    });

    it("matches by full name", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "Jordan");
      expect(screen.getByText("Jordan Lee")).toBeInTheDocument();
    });

    it("matches by email", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "taylor.brooks@example.com");
      expect(screen.getByText("Taylor Brooks")).toBeInTheDocument();
    });

    it("matches case-insensitively and trims whitespace", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "  JORDAN  ");
      expect(screen.getByText("Jordan Lee")).toBeInTheDocument();
    });

    it("shows a small, truthful no-results state for an unmatched query", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "zzz-nobody");
      expect(screen.getByText("No Nexali users found.")).toBeInTheDocument();
    });

    it("never returns the current user as a result (no self entry exists in the mock directory)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "e"); // broad query matching most mock users by name/email
      expect(screen.queryByText(/^you$/i)).not.toBeInTheDocument();
    });
  });

  describe("user display standard", () => {
    it("renders full name before email, with email in a lower-emphasis style (when email is shown -- an exact-email search, see email privacy tests)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "jordan.lee@example.com");

      const name = screen.getByText("Jordan Lee");
      const email = screen.getByText("jordan.lee@example.com");
      expect(name.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(name.className).toMatch(/font-medium/);
      expect(name.className).toMatch(/text-foreground/);
      expect(email.className).toMatch(/text-muted-foreground/);
      expect(email.className).not.toMatch(/font-medium/);
    });

    it("falls back to real initials from the full name when there is no avatar", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Jordan Lee");

      expect(screen.getByText("JL")).toBeInTheDocument();
    });
  });

  describe("sending a friend request", () => {
    it("shows a Plus button for a non-friend, with a user-specific accessible label", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Jordan Lee");

      expect(screen.getByRole("button", { name: "Send friend request to Jordan Lee" })).toBeInTheDocument();
    });

    it("clicking Plus updates local state to Request sent and removes the button (preventing a duplicate request)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Jordan Lee");

      await user.click(screen.getByRole("button", { name: "Send friend request to Jordan Lee" }));

      expect(await screen.findByText("Request sent")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Send friend request to Jordan Lee" })).not.toBeInTheDocument();
    });

    it("shows the already-pending outgoing state truthfully for a user who was already requested", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Priya Patel");

      expect(screen.getByText("Request sent")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /send friend request to priya/i })).not.toBeInTheDocument();
    });

    it("shows Friends (not a Plus button) for someone already a friend", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Alex Nguyen");

      const results = screen.getByRole("region", { name: "Search results" });
      expect(within(results).getByText("Friends")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /send friend request to alex/i })).not.toBeInTheDocument();
    });

    it("shows Request pending for someone who sent the current user an incoming request", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Marcus Chen");

      expect(screen.getByText("Request pending")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /send friend request to marcus/i })).not.toBeInTheDocument();
    });
  });

  describe("incoming friend request notification", () => {
    it("shows the sender's full name, Accept and Decline, but NEVER their email (the receiver never performed an exact-email search)", () => {
      renderWithProviders(<Friends />, { route: "/friends" });

      expect(screen.getByText("Friend Request")).toBeInTheDocument();
      expect(screen.getByText("Marcus Chen")).toBeInTheDocument();
      expect(screen.queryByText("marcus.chen@example.com")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Accept friend request from Marcus Chen" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Decline friend request from Marcus Chen" })).toBeInTheDocument();
    });
  });

  describe("accept flow", () => {
    it("moves the sender into Your Friends and removes the request card", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Accept friend request from Marcus Chen" }));

      expect(screen.queryByText("Friend Requests")).not.toBeInTheDocument();
      const friendsSection = screen.getByRole("heading", { name: "Your Friends" }).closest("section")!;
      expect(within(friendsSection).getByText("Marcus Chen")).toBeInTheDocument();
    });

    it("a subsequent search shows the accepted user as Friends", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Accept friend request from Marcus Chen" }));
      await search(user, "Marcus Chen");

      const results = screen.getByRole("region", { name: "Search results" });
      expect(within(results).getByText("Marcus Chen")).toBeInTheDocument();
      expect(within(results).getByText("Friends")).toBeInTheDocument();
    });
  });

  describe("decline flow", () => {
    it("removes the request without adding the sender to Friends", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Decline friend request from Marcus Chen" }));

      expect(screen.queryByText("Friend Requests")).not.toBeInTheDocument();
      const friendsSection = screen.getByRole("heading", { name: "Your Friends" }).closest("section")!;
      expect(within(friendsSection).queryByText("Marcus Chen")).not.toBeInTheDocument();
    });
  });

  describe("Your Friends", () => {
    it("renders each accepted friend's name/email and a three-dot menu with Remove Friend", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      expect(screen.getByText("Alex Nguyen")).toBeInTheDocument();
      expect(screen.getByText("alex.nguyen@example.com")).toBeInTheDocument();
      expect(screen.getByText("Sarah Tran")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Actions for Alex Nguyen" }));
      expect(await screen.findByRole("menuitem", { name: /remove friend/i })).toBeInTheDocument();
    });
  });

  describe("remove friend", () => {
    it("opens a real confirmation dialog (not window.confirm)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Actions for Alex Nguyen" }));
      await user.click(await screen.findByRole("menuitem", { name: /remove friend/i }));

      expect(await screen.findByRole("dialog", { name: /remove alex nguyen/i })).toBeInTheDocument();
      expect(screen.getByText(/they will be removed from your friends list/i)).toBeInTheDocument();
    });

    it("Cancel keeps the friend", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Actions for Alex Nguyen" }));
      await user.click(await screen.findByRole("menuitem", { name: /remove friend/i }));
      await user.click(await screen.findByRole("button", { name: /^cancel$/i }));

      const friendsSection = screen.getByRole("heading", { name: "Your Friends" }).closest("section")!;
      expect(within(friendsSection).getByText("Alex Nguyen")).toBeInTheDocument();
    });

    it("confirming removes the friend from local state", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Actions for Alex Nguyen" }));
      await user.click(await screen.findByRole("menuitem", { name: /remove friend/i }));
      await user.click(await screen.findByRole("button", { name: /^remove friend$/i }));

      const friendsSection = screen.getByRole("heading", { name: "Your Friends" }).closest("section")!;
      expect(within(friendsSection).queryByText("Alex Nguyen")).not.toBeInTheDocument();
    });

    it("a removed friend returns to an available (Plus button) state in search", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Actions for Alex Nguyen" }));
      await user.click(await screen.findByRole("menuitem", { name: /remove friend/i }));
      await user.click(await screen.findByRole("button", { name: /^remove friend$/i }));

      await search(user, "Alex Nguyen");
      expect(screen.getByRole("button", { name: "Send friend request to Alex Nguyen" })).toBeInTheDocument();
    });
  });

  describe("empty Your Friends state", () => {
    it("shows a truthful empty state once every friend has been removed", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      for (const name of ["Alex Nguyen", "Sarah Tran"]) {
        await user.click(screen.getByRole("button", { name: `Actions for ${name}` }));
        await user.click(await screen.findByRole("menuitem", { name: /remove friend/i }));
        await user.click(await screen.findByRole("button", { name: /^remove friend$/i }));
      }

      expect(screen.getByText("No friends yet")).toBeInTheDocument();
      expect(screen.getByText(/search for people on nexali to add your first friend/i)).toBeInTheDocument();
    });
  });

  describe("email privacy", () => {
    function resultsRegion() {
      return screen.getByRole("region", { name: "Search results" });
    }

    it("hides email for a full-name search", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "Alex");
      const results = resultsRegion();
      expect(within(results).getByText("Alex Nguyen")).toBeInTheDocument();
      expect(within(results).queryByText("alex.nguyen@example.com")).not.toBeInTheDocument();
    });

    it("hides email for a partial-name search", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "Ngu");
      const results = resultsRegion();
      expect(within(results).getByText("Alex Nguyen")).toBeInTheDocument();
      expect(within(results).queryByText("alex.nguyen@example.com")).not.toBeInTheDocument();
    });

    it("hides email for a partial-email search (finds the person, but never reveals the full address)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "alex.nguyen@");
      const results = resultsRegion();
      expect(within(results).getByText("Alex Nguyen")).toBeInTheDocument();
      expect(within(results).queryByText("alex.nguyen@example.com")).not.toBeInTheDocument();
    });

    it("shows email for an exact email search", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "alex.nguyen@example.com");
      const results = resultsRegion();
      expect(within(results).getByText("Alex Nguyen")).toBeInTheDocument();
      expect(within(results).getByText("alex.nguyen@example.com")).toBeInTheDocument();
    });

    it("shows email for an exact email search regardless of case", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "ALEX.NGUYEN@EXAMPLE.COM");
      const results = resultsRegion();
      expect(within(results).getByText("alex.nguyen@example.com")).toBeInTheDocument();
    });

    it("shows email for an exact email search with surrounding whitespace", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "  alex.nguyen@example.com  ");
      const results = resultsRegion();
      expect(within(results).getByText("alex.nguyen@example.com")).toBeInTheDocument();
    });

    it("keeps email hidden for an outgoing request created from a name search", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "Jordan"); // name search
      await user.click(screen.getByRole("button", { name: "Send friend request to Jordan Lee" }));

      const results = resultsRegion();
      expect(await within(results).findByText("Request sent")).toBeInTheDocument();
      expect(within(results).queryByText("jordan.lee@example.com")).not.toBeInTheDocument();
    });

    it("keeps email visible for an outgoing request while the exact-email search that found them is still active", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await search(user, "jordan.lee@example.com"); // exact email search
      await user.click(screen.getByRole("button", { name: "Send friend request to Jordan Lee" }));

      const results = resultsRegion();
      expect(await within(results).findByText("Request sent")).toBeInTheDocument();
      expect(within(results).getByText("jordan.lee@example.com")).toBeInTheDocument();
    });

    it("never shows the sender's email on the incoming friend request card", () => {
      renderWithProviders(<Friends />, { route: "/friends" });
      expect(screen.getByText("Marcus Chen")).toBeInTheDocument();
      expect(screen.queryByText("marcus.chen@example.com")).not.toBeInTheDocument();
    });

    it("always shows email for an accepted friend in Your Friends", () => {
      renderWithProviders(<Friends />, { route: "/friends" });
      const friendsSection = screen.getByRole("heading", { name: "Your Friends" }).closest("section")!;
      expect(within(friendsSection).getByText("alex.nguyen@example.com")).toBeInTheDocument();
      expect(within(friendsSection).getByText("sarah.tran@example.com")).toBeInTheDocument();
    });
  });
});
