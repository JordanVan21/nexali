import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrendingUp } from "lucide-react";
import { renderWithProviders } from "../test/renderWithProviders";
import Notifications from "./Notifications";
import type { NotificationItemData } from "../lib/notifications";

type QueryState<T> = { data: T | undefined; isLoading: boolean; isError: boolean; error: Error | null };

const markReadMutate = vi.fn();
const dismissMutate = vi.fn();
const markAllMutate = vi.fn();
const feedRefetch = vi.fn();

let feedByFilter: Record<string, QueryState<NotificationItemData[]>>;
let unreadCountState: QueryState<number>;
let markAllPending = false;

function defaultFeedState(): QueryState<NotificationItemData[]> {
  return { data: [], isLoading: false, isError: false, error: null };
}

vi.mock("../features/notifications/useNotifications", () => ({
  useNotificationsFeed: (_userId: string | undefined, filter: string) => ({
    ...(feedByFilter[filter] ?? defaultFeedState()),
    refetch: feedRefetch,
  }),
  useUnreadNotificationCount: () => unreadCountState,
  useMarkNotificationRead: () => ({ mutate: markReadMutate }),
  useDismissNotification: () => ({ mutate: dismissMutate }),
  useMarkAllNotificationsRead: () => ({
    mutate: markAllMutate,
    get isPending() {
      return markAllPending;
    },
  }),
}));

type IncomingFixture = { requestId: string; senderId: string; senderFullName: string; senderAvatarUrl: string | null; createdAt: string };

const acceptRequestMutate = vi.fn();
const declineRequestMutate = vi.fn();
let incomingRequestsState: QueryState<IncomingFixture[]> = { data: [], isLoading: false, isError: false, error: null };
let acceptPendingId: string | null = null;
let declinePendingId: string | null = null;

vi.mock("../features/friends/useFriendsQueries", () => ({
  useListIncomingFriendRequests: () => incomingRequestsState,
  useAcceptFriendRequest: () => ({
    mutate: acceptRequestMutate,
    get isPending() {
      return acceptPendingId !== null;
    },
    get variables() {
      return acceptPendingId;
    },
  }),
  useDeclineFriendRequest: () => ({
    mutate: declineRequestMutate,
    get isPending() {
      return declinePendingId !== null;
    },
    get variables() {
      return declinePendingId;
    },
  }),
}));

function fixture(overrides: Partial<NotificationItemData> = {}): NotificationItemData {
  return {
    id: "n1",
    type: "financial",
    icon: TrendingUp,
    title: "Budget approaching limit",
    description: "You've used 80% of your Dining budget for September 2026.",
    createdAt: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

function loaded(items: NotificationItemData[], unread = items.filter((n) => !n.read).length) {
  feedByFilter = { all: { data: items, isLoading: false, isError: false, error: null } };
  unreadCountState = { data: unread, isLoading: false, isError: false, error: null };
}

describe("Notifications page (Backend Part 7: real data)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    markAllPending = false;
    incomingRequestsState = { data: [], isLoading: false, isError: false, error: null };
    acceptPendingId = null;
    declinePendingId = null;
  });

  it("renders the page heading", () => {
    loaded([]);
    renderWithProviders(<Notifications />);
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
  });

  it("shows a loading skeleton while the feed is loading, not an empty state", () => {
    feedByFilter = { all: { data: undefined, isLoading: true, isError: false, error: null } };
    unreadCountState = { data: undefined, isLoading: true, isError: false, error: null };
    renderWithProviders(<Notifications />);

    expect(screen.getByLabelText(/loading notifications/i)).toBeInTheDocument();
    expect(screen.queryByText(/no notifications yet/i)).not.toBeInTheDocument();
  });

  it("shows a retryable error state when the feed query fails", () => {
    feedByFilter = { all: { data: undefined, isLoading: false, isError: true, error: new Error("network down") } };
    unreadCountState = { data: 0, isLoading: false, isError: false, error: null };
    renderWithProviders(<Notifications />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retry calls the feed's real refetch", async () => {
    feedByFilter = { all: { data: undefined, isLoading: false, isError: true, error: new Error("down") } };
    unreadCountState = { data: 0, isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Notifications />);

    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(feedRefetch).toHaveBeenCalled();
  });

  it("shows a truthful empty state for a real zero-notification feed", () => {
    loaded([]);
    renderWithProviders(<Notifications />);
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it("renders the real unread count from the server, not derived from the visible/filtered list", () => {
    loaded([fixture({ id: "n1", read: false })], 3);
    renderWithProviders(<Notifications />);
    expect(screen.getByText("3 unread notifications")).toBeInTheDocument();
  });

  it("renders a real notification and its title/description", () => {
    loaded([fixture()]);
    renderWithProviders(<Notifications />);

    expect(screen.getByText("Budget approaching limit")).toBeInTheDocument();
    expect(screen.getByText(/you've used 80% of your dining budget/i)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("groups notifications under Today when created_at is today", () => {
    loaded([fixture({ createdAt: new Date().toISOString() })]);
    renderWithProviders(<Notifications />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("mark as read calls the real mutation with this notification's id", async () => {
    loaded([fixture({ id: "n42", read: false })]);
    const user = userEvent.setup();
    renderWithProviders(<Notifications />);

    await user.click(screen.getByRole("button", { name: /mark as read/i }));
    expect(markReadMutate).toHaveBeenCalledWith("n42");
  });

  it("dismiss calls the real mutation with this notification's id", async () => {
    loaded([fixture({ id: "n42", title: "Budget exceeded" })]);
    const user = userEvent.setup();
    renderWithProviders(<Notifications />);

    await user.click(screen.getByRole("button", { name: /dismiss notification: budget exceeded/i }));
    expect(dismissMutate).toHaveBeenCalledWith("n42");
  });

  it("mark all as read calls the real bulk mutation and is disabled when unread count is 0", async () => {
    loaded([fixture({ read: false })], 0);
    renderWithProviders(<Notifications />);

    const button = screen.getByRole("button", { name: /mark all as read/i });
    expect(button).toBeDisabled();
  });

  it("mark all as read is enabled and wired when there is a real unread count", async () => {
    loaded([fixture({ read: false })], 2);
    const user = userEvent.setup();
    renderWithProviders(<Notifications />);

    const button = screen.getByRole("button", { name: /mark all as read/i });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(markAllMutate).toHaveBeenCalled();
  });

  it("switching filter tabs requests the server-filtered feed for that tab", async () => {
    feedByFilter = {
      all: { data: [fixture({ id: "n1", type: "financial" })], isLoading: false, isError: false, error: null },
      security: { data: [fixture({ id: "n2", type: "security", title: "New sign-in" })], isLoading: false, isError: false, error: null },
    };
    unreadCountState = { data: 1, isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Notifications />);

    expect(screen.getByText("Budget approaching limit")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Security" }));
    expect(screen.getByText("New sign-in")).toBeInTheDocument();
    expect(screen.queryByText("Budget approaching limit")).not.toBeInTheDocument();
  });

  it("never renders Lovable's mock notification content", () => {
    loaded([]);
    renderWithProviders(<Notifications />);

    expect(screen.queryByText(/dining & takeout/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/new device sign-in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/direct deposit received/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/password changed successfully/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aura found a savings opportunity/i)).not.toBeInTheDocument();
  });

  it("renders the real All/Unread/category filter tabs", () => {
    loaded([]);
    renderWithProviders(<Notifications />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["All", "Unread", "Financial", "Security", "System", "Assistant"]);
  });

  it("shows the unread-specific empty-state copy on the Unread tab with zero results", async () => {
    feedByFilter = {
      all: { data: [], isLoading: false, isError: false, error: null },
      unread: { data: [], isLoading: false, isError: false, error: null },
    };
    unreadCountState = { data: 0, isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Notifications />);

    await user.click(screen.getByRole("tab", { name: "Unread" }));
    await waitFor(() => expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument());
  });

  describe("friend_request notifications (Backend Part 8 integration)", () => {
    function friendRequestNotification(overrides: Partial<NotificationItemData> = {}): NotificationItemData {
      return fixture({
        id: "n-fr1",
        type: "friend_request",
        title: "New friend request",
        description: "Marcus Chen sent you a friend request.",
        friendRequestId: "req-marcus",
        ...overrides,
      });
    }

    function marcus(): IncomingFixture {
      return { requestId: "req-marcus", senderId: "u-marcus", senderFullName: "Marcus Chen", senderAvatarUrl: null, createdAt: new Date().toISOString() };
    }

    it("renders a friend_request notification as an actionable FriendRequestNotificationCard with the sender's name, never their email", () => {
      loaded([friendRequestNotification()]);
      incomingRequestsState = { data: [marcus()], isLoading: false, isError: false, error: null };
      renderWithProviders(<Notifications />);

      expect(screen.getByText("Marcus Chen")).toBeInTheDocument();
      expect(screen.getByText("sent you a friend request.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Accept friend request from Marcus Chen" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Decline friend request from Marcus Chen" })).toBeInTheDocument();
      expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    });

    it("Accept calls the real accept mutation with this request's id", async () => {
      loaded([friendRequestNotification()]);
      incomingRequestsState = { data: [marcus()], isLoading: false, isError: false, error: null };
      const user = userEvent.setup();
      renderWithProviders(<Notifications />);

      await user.click(screen.getByRole("button", { name: "Accept friend request from Marcus Chen" }));
      expect(acceptRequestMutate).toHaveBeenCalledWith("req-marcus");
    });

    it("Decline calls the real decline mutation with this request's id", async () => {
      loaded([friendRequestNotification()]);
      incomingRequestsState = { data: [marcus()], isLoading: false, isError: false, error: null };
      const user = userEvent.setup();
      renderWithProviders(<Notifications />);

      await user.click(screen.getByRole("button", { name: "Decline friend request from Marcus Chen" }));
      expect(declineRequestMutate).toHaveBeenCalledWith("req-marcus");
    });

    it("disables Accept and Decline while this specific request's mutation is pending", () => {
      loaded([friendRequestNotification()]);
      incomingRequestsState = { data: [marcus()], isLoading: false, isError: false, error: null };
      acceptPendingId = "req-marcus";
      renderWithProviders(<Notifications />);

      expect(screen.getByRole("button", { name: "Accept friend request from Marcus Chen" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Decline friend request from Marcus Chen" })).toBeDisabled();
    });

    it("falls back to the plain NotificationItem when no matching incoming request is found (safe edge case, no crash)", () => {
      loaded([friendRequestNotification({ friendRequestId: "req-orphaned" })]);
      incomingRequestsState = { data: [], isLoading: false, isError: false, error: null };
      renderWithProviders(<Notifications />);

      expect(screen.getByText("New friend request")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /accept friend request/i })).not.toBeInTheDocument();
    });

    it("the System tab includes friend_request notifications (no separate tab was added)", async () => {
      feedByFilter = {
        all: { data: [], isLoading: false, isError: false, error: null },
        system: { data: [friendRequestNotification()], isLoading: false, isError: false, error: null },
      };
      unreadCountState = { data: 1, isLoading: false, isError: false, error: null };
      incomingRequestsState = { data: [marcus()], isLoading: false, isError: false, error: null };
      const user = userEvent.setup();
      renderWithProviders(<Notifications />);

      const tabs = screen.getAllByRole("tab");
      expect(tabs.map((t) => t.textContent)).toEqual(["All", "Unread", "Financial", "Security", "System", "Assistant"]);

      await user.click(screen.getByRole("tab", { name: "System" }));
      expect(screen.getByText("Marcus Chen")).toBeInTheDocument();
    });

    it("the unread count reflects a new friend_request notification like any other type", () => {
      loaded([friendRequestNotification({ read: false })], 1);
      incomingRequestsState = { data: [marcus()], isLoading: false, isError: false, error: null };
      renderWithProviders(<Notifications />);

      expect(screen.getByText("1 unread notification")).toBeInTheDocument();
    });
  });
});
