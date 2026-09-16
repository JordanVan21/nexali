import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserIdProvider } from "./shared/userIdContext";
import AppLayout from "./AppLayout";
import Friends from "./pages/Friends";
import type { IncomingFriendRequest, NexaliUserPreview } from "./lib/friends";

vi.mock("./features/profiles/useAvatar", () => ({
  useAvatar: () => ({ data: null }),
}));
vi.mock("./features/user/useSignOut", () => ({
  useSignOut: () => vi.fn(),
}));
vi.mock("./features/notifications/useNotifications", () => ({
  useUnreadNotificationCount: () => ({ data: 0, isLoading: false, isError: false }),
}));

/**
 * Real friendsData functions mocked at the lowest layer -- everything
 * above them (useFriendsQueries.ts's hooks, Friends.tsx, AppNav's/
 * MobileHeader's badge) runs unmocked and for real, sharing ONE
 * QueryClient. This is what actually proves the nav badge and the Friends
 * page stay in sync now: no custom Friends context/provider exists
 * anymore (Backend Part 8 removed it) -- they share a real TanStack Query
 * cache entry (qk.friendsIncomingCount) the same way the Notifications
 * badge always has, and a successful accept/decline mutation invalidates
 * it for every subscriber at once.
 */
let incoming: IncomingFriendRequest[] = [];
let friends: NexaliUserPreview[] = [];
const acceptFriendRequestMock = vi.fn();
const declineFriendRequestMock = vi.fn();

vi.mock("./lib/friendsData", () => ({
  listIncomingFriendRequests: () => Promise.resolve(incoming),
  getIncomingFriendRequestCount: () => Promise.resolve(incoming.length),
  listFriends: () => Promise.resolve(friends),
  searchNexaliUsers: () => Promise.resolve([]),
  sendFriendRequest: () => Promise.resolve("new-request-id"),
  acceptFriendRequest: (id: string) => acceptFriendRequestMock(id),
  declineFriendRequest: (id: string) => declineFriendRequestMock(id),
  removeFriend: () => Promise.resolve(),
}));

function marcusChen(): IncomingFriendRequest {
  return { requestId: "req-marcus", senderId: "u-marcus", senderFullName: "Marcus Chen", senderAvatarUrl: null, createdAt: "2026-09-19T00:00:00.000Z" };
}

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <UserIdProvider value={{ userId: "test-user-id", email: "test@example.com" }}>
          <Routes>
            <Route path="/public" element={<div>Public page</div>} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<div>Dashboard content</div>} />
              <Route path="/friends" element={<Friends />} />
            </Route>
          </Routes>
        </UserIdProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AppLayout", () => {
  it("renders the authenticated navigation around a protected route", () => {
    renderApp("/dashboard");

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Bottom" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("does not render authenticated navigation on a public route", () => {
    renderApp("/public");

    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Bottom" })).not.toBeInTheDocument();
    expect(screen.getByText("Public page")).toBeInTheDocument();
  });

  describe("Friends badge shares live state with the Friends page (real TanStack Query cache, no custom provider)", () => {
    it("accepting an incoming request on the Friends page immediately decreases the nav badge", async () => {
      incoming = [marcusChen()];
      friends = [];
      // Simulates the real server-side effect (the request is no longer
      // pending) so the badge's re-fetch after invalidation genuinely
      // reflects it -- not just "the mutation was called".
      acceptFriendRequestMock.mockImplementation(async (id: string) => {
        incoming = incoming.filter((r) => r.requestId !== id);
      });
      const user = userEvent.setup();
      renderApp("/friends");

      const primaryNav = screen.getByRole("navigation", { name: "Primary" });
      expect(await within(primaryNav).findByRole("link", { name: "Friends, 1 pending request" })).toBeInTheDocument();

      await user.click(await screen.findByRole("button", { name: "Accept friend request from Marcus Chen" }));

      expect(await within(primaryNav).findByRole("link", { name: "Friends" })).toBeInTheDocument();
      expect(within(primaryNav).queryByRole("link", { name: /pending request/i })).not.toBeInTheDocument();
    });

    it("declining an incoming request on the Friends page immediately decreases the nav badge", async () => {
      incoming = [marcusChen()];
      friends = [];
      declineFriendRequestMock.mockImplementation(async (id: string) => {
        incoming = incoming.filter((r) => r.requestId !== id);
      });
      const user = userEvent.setup();
      renderApp("/friends");

      const primaryNav = screen.getByRole("navigation", { name: "Primary" });
      expect(await within(primaryNav).findByRole("link", { name: "Friends, 1 pending request" })).toBeInTheDocument();

      await user.click(await screen.findByRole("button", { name: "Decline friend request from Marcus Chen" }));

      expect(await within(primaryNav).findByRole("link", { name: "Friends" })).toBeInTheDocument();
    });
  });
});
