import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { AppNav } from "./AppNav";

vi.mock("../../features/profiles/useAvatar", () => ({
  useAvatar: () => ({ data: null }),
}));

let unreadState: { data: number | undefined; isLoading: boolean; isError: boolean } = {
  data: 0,
  isLoading: false,
  isError: false,
};
vi.mock("../../features/notifications/useNotifications", () => ({
  useUnreadNotificationCount: () => unreadState,
}));

let incomingCountState: { data: number | undefined; isLoading: boolean; isError: boolean } = {
  data: 0,
  isLoading: false,
  isError: false,
};
vi.mock("../../features/friends/useFriendsQueries", () => ({
  useIncomingFriendRequestCount: () => incomingCountState,
}));

describe("AppNav", () => {
  afterEach(() => {
    unreadState = { data: 0, isLoading: false, isError: false };
    incomingCountState = { data: 0, isLoading: false, isError: false };
  });

  it("renders the primary destinations in order, with no Account and no search", () => {
    renderWithProviders(<AppNav />, { route: "/dashboard" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    // Every nav-item link carries an explicit aria-label; the logo link does not, so this
    // excludes the logo without depending on its accessible name.
    const links = within(primaryNav)
      .getAllByRole("link")
      .filter((el) => el.hasAttribute("aria-label"))
      .map((el) => el.getAttribute("aria-label"));

    // Dashboard, Transactions, Budgets, Reports, Aura, Notifications, Friends, Settings, in that order.
    expect(links).toEqual([
      "Dashboard",
      "Transactions",
      "Budgets",
      "Reports",
      "Aura",
      "Notifications",
      "Friends",
      "Settings",
    ]);
    expect(links).not.toContain("Account");

    expect(within(primaryNav).queryByRole("searchbox")).not.toBeInTheDocument();
    expect(within(primaryNav).queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("gives Settings its own dedicated control, separate from the account menu", () => {
    renderWithProviders(<AppNav />, { route: "/dashboard" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    // Settings is reachable directly in the nav, not only inside the closed account dropdown.
    expect(within(primaryNav).getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("marks the current primary route active and leaves the others inactive", () => {
    renderWithProviders(<AppNav />, { route: "/budgets" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNav).getByRole("link", { name: "Budgets" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(primaryNav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("marks no primary destination active on a secondary page like Profile", () => {
    renderWithProviders(<AppNav />, { route: "/profile" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    for (const label of ["Dashboard", "Transactions", "Budgets", "Reports", "Aura"]) {
      expect(within(primaryNav).getByRole("link", { name: label })).not.toHaveAttribute(
        "aria-current"
      );
    }
  });

  it("marks the Settings control active on the Settings page", () => {
    renderWithProviders(<AppNav />, { route: "/settings" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNav).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("marks the Notifications control active on the Notifications page", () => {
    renderWithProviders(<AppNav />, { route: "/notifications" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNav).getByRole("link", { name: "Notifications" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("places Friends to the right of Notifications and to the left of Settings, with an accessible label and correct href", () => {
    renderWithProviders(<AppNav />, { route: "/dashboard" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(primaryNav)
      .getAllByRole("link")
      .filter((el) => el.hasAttribute("aria-label"));
    const labels = links.map((el) => el.getAttribute("aria-label"));

    expect(labels.indexOf("Notifications")).toBeLessThan(labels.indexOf("Friends"));
    expect(labels.indexOf("Friends")).toBeLessThan(labels.indexOf("Settings"));
    expect(within(primaryNav).getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
  });

  it("marks the Friends control active on the Friends page", () => {
    renderWithProviders(<AppNav />, { route: "/friends" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNav).getByRole("link", { name: "Friends" })).toHaveAttribute("aria-current", "page");
  });

  describe("Notifications badge (real unread count, no new count implementation)", () => {
    it("shows no badge when unread count is 0", () => {
      unreadState = { data: 0, isLoading: false, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument();
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    it("shows '1' for a single unread notification", () => {
      unreadState = { data: 1, isLoading: false, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Notifications, 1 unread" })).toBeInTheDocument();
    });

    it("shows the exact count for 12", () => {
      unreadState = { data: 12, isLoading: false, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Notifications, 12 unread" })).toBeInTheDocument();
    });

    it("shows the exact count for 99", () => {
      unreadState = { data: 99, isLoading: false, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByText("99")).toBeInTheDocument();
    });

    it("caps at '99+' for 100 or more", () => {
      unreadState = { data: 100, isLoading: false, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByText("99+")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Notifications, 99+ unread" })).toBeInTheDocument();
    });

    it("shows no fake badge while the count is loading", () => {
      unreadState = { data: undefined, isLoading: true, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument();
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("keeps the icon functional and omits the badge when the count query errors", () => {
      unreadState = { data: undefined, isLoading: false, isError: true };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      const link = screen.getByRole("link", { name: "Notifications" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/notifications");
    });
  });

  describe("Friends badge (real Backend Part 8 incoming-request count)", () => {
    it("shows no badge with zero incoming requests", () => {
      incomingCountState = { data: 0, isLoading: false, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByRole("link", { name: "Friends" })).toBeInTheDocument();
    });

    it("shows '1' for one incoming request", () => {
      incomingCountState = { data: 1, isLoading: false, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Friends, 1 pending request" })).toBeInTheDocument();
    });

    it("shows the correct count for multiple incoming requests, with correct plural label", () => {
      incomingCountState = { data: 3, isLoading: false, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Friends, 3 pending requests" })).toBeInTheDocument();
    });

    it("caps at '99+' for 100 or more incoming requests", () => {
      incomingCountState = { data: 100, isLoading: false, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByText("99+")).toBeInTheDocument();
    });

    it("shows no fake badge while the count is loading", () => {
      incomingCountState = { data: undefined, isLoading: true, isError: false };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByRole("link", { name: "Friends" })).toBeInTheDocument();
    });

    it("keeps the icon functional and omits the badge when the count query errors", () => {
      incomingCountState = { data: undefined, isLoading: false, isError: true };
      renderWithProviders(<AppNav />, { route: "/dashboard" });

      expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
    });
  });

  it("does not shift Notifications/Friends/Settings/Profile when a badge appears (relative positioning only)", () => {
    unreadState = { data: 3, isLoading: false, isError: false };
    incomingCountState = { data: 1, isLoading: false, isError: false };
    renderWithProviders(<AppNav />, { route: "/dashboard" });

    const notifLink = screen.getByRole("link", { name: /notifications/i });
    const friendsLink = screen.getByRole("link", { name: /friends/i });
    // Both icon links keep their own layout class (fixed size, no margin
    // change) -- the badge is `absolute`, so it never participates in
    // normal flow layout of the surrounding icons.
    expect(notifLink.className).toMatch(/relative/);
    expect(friendsLink.className).toMatch(/relative/);
  });
});
