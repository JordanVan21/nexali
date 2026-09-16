import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { MobileHeader } from "./MobileHeader";

vi.mock("../../features/profiles/useAvatar", () => ({
  useAvatar: () => ({ data: null }),
}));

let incomingCountState: { data: number | undefined; isLoading: boolean; isError: boolean } = {
  data: 0,
  isLoading: false,
  isError: false,
};
vi.mock("../../features/friends/useFriendsQueries", () => ({
  useIncomingFriendRequestCount: () => incomingCountState,
}));

describe("MobileHeader", () => {
  afterEach(() => {
    incomingCountState = { data: 0, isLoading: false, isError: false };
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

  describe("Friends badge (real Backend Part 8 incoming-request count)", () => {
    it("shows no badge with zero incoming requests", () => {
      incomingCountState = { data: 0, isLoading: false, isError: false };
      renderWithProviders(<MobileHeader />);

      expect(screen.getByRole("link", { name: "Friends" })).toBeInTheDocument();
    });

    it("shows the pending-request count and matching accessible label", () => {
      incomingCountState = { data: 2, isLoading: false, isError: false };
      renderWithProviders(<MobileHeader />);

      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Friends, 2 pending requests" })).toBeInTheDocument();
    });

    it("caps at '99+'", () => {
      incomingCountState = { data: 150, isLoading: false, isError: false };
      renderWithProviders(<MobileHeader />);

      expect(screen.getByText("99+")).toBeInTheDocument();
    });

    it("shows no fake badge while the count is loading", () => {
      incomingCountState = { data: undefined, isLoading: true, isError: false };
      renderWithProviders(<MobileHeader />);

      expect(screen.getByRole("link", { name: "Friends" })).toBeInTheDocument();
    });

    it("keeps the icon functional and omits the badge when the count query errors", () => {
      incomingCountState = { data: undefined, isLoading: false, isError: true };
      renderWithProviders(<MobileHeader />);

      expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
    });

    it("does not obscure or reposition the profile avatar trigger", () => {
      incomingCountState = { data: 1, isLoading: false, isError: false };
      renderWithProviders(<MobileHeader />);

      const friendsLink = screen.getByRole("link", { name: /friends/i });
      const accountButton = screen.getByRole("button", { name: "Account menu" });
      expect(friendsLink.className).toMatch(/relative/);
      // Still immediately before the avatar trigger in the DOM, badge or not.
      expect(friendsLink.compareDocumentPosition(accountButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
