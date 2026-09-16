import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { MobileHeader } from "./MobileHeader";
import type { NexaliUserPreview } from "../../lib/friends";

vi.mock("../../features/profiles/useAvatar", () => ({
  useAvatar: () => ({ data: null }),
}));

let incomingRequests: NexaliUserPreview[] = [];
vi.mock("../../features/friends/useFriends", () => ({
  useFriends: () => ({ incomingRequests }),
}));

function pendingUser(id: string): NexaliUserPreview {
  return { id, fullName: "Someone", email: "someone@example.com", avatarUrl: null, status: "incoming_pending" };
}

describe("MobileHeader", () => {
  afterEach(() => {
    incomingRequests = [];
  });

  it("renders the Nexali brand link on the left", () => {
    renderWithProviders(<MobileHeader />);

    const brandLink = screen.getByRole("link", { name: "Nexali home" });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute("href", "/dashboard");
  });

  it("renders the account menu trigger, with no standalone Notifications or Settings icon", () => {
    renderWithProviders(<MobileHeader />);

    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /notifications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
  });

  it("renders a standalone Friends icon immediately to the left of the avatar menu", () => {
    renderWithProviders(<MobileHeader />);

    const friendsLink = screen.getByRole("link", { name: "Friends" });
    expect(friendsLink).toHaveAttribute("href", "/friends");

    // Order in the DOM: Friends icon, then the profile avatar trigger.
    const accountButton = screen.getByRole("button", { name: "Account menu" });
    expect(friendsLink.compareDocumentPosition(accountButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks Friends active on the Friends page", () => {
    renderWithProviders(<MobileHeader />, { route: "/friends" });
    expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("aria-current", "page");
  });

  it("does not render a hamburger menu trigger", () => {
    renderWithProviders(<MobileHeader />);

    expect(screen.queryByRole("button", { name: /open menu/i })).not.toBeInTheDocument();
  });

  describe("Friends badge", () => {
    it("shows no badge with zero incoming requests", () => {
      incomingRequests = [];
      renderWithProviders(<MobileHeader />);

      expect(screen.getByRole("link", { name: "Friends" })).toBeInTheDocument();
    });

    it("shows the pending-request count and matching accessible label", () => {
      incomingRequests = [pendingUser("a"), pendingUser("b")];
      renderWithProviders(<MobileHeader />);

      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Friends, 2 pending requests" })).toBeInTheDocument();
    });

    it("caps at '99+'", () => {
      incomingRequests = Array.from({ length: 150 }, (_, i) => pendingUser(String(i)));
      renderWithProviders(<MobileHeader />);

      expect(screen.getByText("99+")).toBeInTheDocument();
    });

    it("does not obscure or reposition the profile avatar trigger", () => {
      incomingRequests = [pendingUser("a")];
      renderWithProviders(<MobileHeader />);

      const friendsLink = screen.getByRole("link", { name: /friends/i });
      const accountButton = screen.getByRole("button", { name: "Account menu" });
      expect(friendsLink.className).toMatch(/relative/);
      // Still immediately before the avatar trigger in the DOM, badge or not.
      expect(friendsLink.compareDocumentPosition(accountButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
