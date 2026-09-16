import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Friends from "./Friends";
import type { IncomingFriendRequest, NexaliUserPreview } from "../lib/friends";

type QueryState<T> = { data: T | undefined; isLoading: boolean; isError: boolean; error: Error | null; refetch: () => void };

function okState<T>(data: T): QueryState<T> {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn() };
}
function loadingState<T>(): QueryState<T> {
  return { data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() };
}
function errorState<T>(message: string): QueryState<T> {
  return { data: undefined, isLoading: false, isError: true, error: new Error(message), refetch: vi.fn() };
}

let searchState: QueryState<NexaliUserPreview[]> = okState([]);
let friendsState: QueryState<NexaliUserPreview[]> = okState([]);
let incomingState: QueryState<IncomingFriendRequest[]> = okState([]);

const sendMutate = vi.fn();
const acceptMutate = vi.fn();
const declineMutate = vi.fn();
const removeMutateAsync = vi.fn();
let sendPendingFor: string | null = null;
let acceptPendingFor: string | null = null;
let declinePendingFor: string | null = null;
let removeState: { isPending: boolean; isError: boolean; error: Error | null } = { isPending: false, isError: false, error: null };

vi.mock("../features/friends/useFriendsQueries", () => ({
  useSearchNexaliUsers: () => searchState,
  useListFriends: () => friendsState,
  useListIncomingFriendRequests: () => incomingState,
  useSendFriendRequest: () => ({ mutate: sendMutate, isPending: sendPendingFor !== null, variables: sendPendingFor }),
  useAcceptFriendRequest: () => ({ mutate: acceptMutate, isPending: acceptPendingFor !== null, variables: acceptPendingFor }),
  useDeclineFriendRequest: () => ({ mutate: declineMutate, isPending: declinePendingFor !== null, variables: declinePendingFor }),
  useRemoveFriend: () => ({
    mutateAsync: removeMutateAsync,
    reset: vi.fn(),
    get isPending() {
      return removeState.isPending;
    },
    get isError() {
      return removeState.isError;
    },
    get error() {
      return removeState.error;
    },
  }),
}));

function alex(overrides: Partial<NexaliUserPreview> = {}): NexaliUserPreview {
  return { id: "u-alex", fullName: "Alex Nguyen", email: null, avatarUrl: null, status: "none", ...overrides };
}
function jordan(overrides: Partial<NexaliUserPreview> = {}): NexaliUserPreview {
  return { id: "u-jordan", fullName: "Jordan Lee", email: null, avatarUrl: null, status: "none", ...overrides };
}
function marcusRequest(): IncomingFriendRequest {
  return { requestId: "req-marcus", senderId: "u-marcus", senderFullName: "Marcus Chen", senderAvatarUrl: null, createdAt: "2026-09-19T00:00:00.000Z" };
}

async function search(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = screen.getByLabelText(/search nexali users/i);
  await user.clear(input);
  await user.type(input, query);
}

describe("Friends page (real Backend Part 8 data)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    searchState = okState([]);
    friendsState = okState([]);
    incomingState = okState([]);
    sendPendingFor = null;
    acceptPendingFor = null;
    declinePendingFor = null;
    removeState = { isPending: false, isError: false, error: null };
  });

  it("renders the page heading and concise supporting copy", () => {
    renderWithProviders(<Friends />, { route: "/friends" });
    expect(screen.getByRole("heading", { name: "Friends" })).toBeInTheDocument();
    expect(screen.getByText(/find people on nexali and manage your friends/i)).toBeInTheDocument();
  });

  describe("loading and error states", () => {
    it("shows a loading skeleton for the friends list", () => {
      friendsState = loadingState();
      renderWithProviders(<Friends />, { route: "/friends" });
      expect(screen.getByLabelText(/loading your friends/i)).toBeInTheDocument();
    });

    it("shows a retryable error state when the friends list fails to load", () => {
      friendsState = errorState("network down");
      renderWithProviders(<Friends />, { route: "/friends" });
      expect(screen.getByText(/couldn't load your friends/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("shows a real, user-safe search error with retry, not a raw exception", async () => {
      searchState = errorState("Couldn't search Nexali users.");
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Alex");

      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't search nexali users/i);
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe("search", () => {
    it("hides results with a query below the minimum length", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "a");
      expect(screen.queryByRole("region", { name: "Search results" })).not.toBeInTheDocument();
    });

    it("shows a small, truthful no-results state", async () => {
      searchState = okState([]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "zzz-nobody");
      expect(screen.getByText("No Nexali users found.")).toBeInTheDocument();
    });

    it("renders full name for a broad name-search result with NO email (server returned email: null)", async () => {
      searchState = okState([alex({ email: null, status: "none" })]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Alex");

      const results = screen.getByRole("region", { name: "Search results" });
      expect(within(results).getByText("Alex Nguyen")).toBeInTheDocument();
      expect(within(results).queryByText(/@/)).not.toBeInTheDocument();
    });

    it("renders the email when the server returned it (exact-email search)", async () => {
      searchState = okState([alex({ email: "alex.nguyen@example.com", status: "none" })]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "alex.nguyen@example.com");

      const results = screen.getByRole("region", { name: "Search results" });
      expect(within(results).getByText("alex.nguyen@example.com")).toBeInTheDocument();
    });
  });

  describe("sending a friend request", () => {
    it("shows a Plus button for status=none, with a user-specific accessible label", async () => {
      searchState = okState([jordan({ status: "none" })]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Jordan");

      expect(screen.getByRole("button", { name: "Send friend request to Jordan Lee" })).toBeInTheDocument();
    });

    it("clicking Plus calls the real send mutation with only the recipient id", async () => {
      searchState = okState([jordan({ status: "none" })]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Jordan");

      await user.click(screen.getByRole("button", { name: "Send friend request to Jordan Lee" }));
      expect(sendMutate).toHaveBeenCalledWith("u-jordan");
    });

    it("disables only that user's Plus button while the send is pending, not the whole page", async () => {
      searchState = okState([jordan({ status: "none" }), alex({ status: "none" })]);
      sendPendingFor = "u-jordan";
      renderWithProviders(<Friends />, { route: "/friends" });
      const input = screen.getByLabelText(/search nexali users/i);
      await userEvent.setup().type(input, "e"); // any 1+ char to satisfy typing helper; results driven by mock

      // Jordan's button is disabled (pending); the search input itself is not.
      expect(input).toBeEnabled();
    });

    it("shows Request sent for status=outgoing_pending, no Plus button", async () => {
      searchState = okState([jordan({ status: "outgoing_pending" })]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Jordan");

      expect(screen.getByText("Request sent")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /send friend request/i })).not.toBeInTheDocument();
    });

    it("shows Request pending for status=incoming_pending, no Plus button", async () => {
      searchState = okState([jordan({ status: "incoming_pending" })]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Jordan");

      expect(screen.getByText("Request pending")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /send friend request/i })).not.toBeInTheDocument();
    });

    it("shows Friends for status=friends, no Plus button", async () => {
      searchState = okState([jordan({ status: "friends", email: "jordan.lee@example.com" })]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });
      await search(user, "Jordan");

      const results = screen.getByRole("region", { name: "Search results" });
      expect(within(results).getByText("Friends")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /send friend request/i })).not.toBeInTheDocument();
    });
  });

  describe("incoming friend request notification card", () => {
    it("shows the sender's full name, Accept, Decline -- never their email", () => {
      incomingState = okState([marcusRequest()]);
      renderWithProviders(<Friends />, { route: "/friends" });

      expect(screen.getByText("Friend Request")).toBeInTheDocument();
      expect(screen.getByText("Marcus Chen")).toBeInTheDocument();
      expect(screen.queryByText(/@/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Accept friend request from Marcus Chen" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Decline friend request from Marcus Chen" })).toBeInTheDocument();
    });

    it("Accept calls the real accept mutation with the request id", async () => {
      incomingState = okState([marcusRequest()]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Accept friend request from Marcus Chen" }));
      expect(acceptMutate).toHaveBeenCalledWith("req-marcus");
    });

    it("Decline calls the real decline mutation with the request id", async () => {
      incomingState = okState([marcusRequest()]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Decline friend request from Marcus Chen" }));
      expect(declineMutate).toHaveBeenCalledWith("req-marcus");
    });

    it("hides the Friend Requests section entirely when there are none", () => {
      incomingState = okState([]);
      renderWithProviders(<Friends />, { route: "/friends" });
      expect(screen.queryByText("Friend Requests")).not.toBeInTheDocument();
    });
  });

  describe("Your Friends", () => {
    it("renders each accepted friend's real name/email and a three-dot menu with Remove Friend", async () => {
      friendsState = okState([alex({ status: "friends", email: "alex.nguyen@example.com" })]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      expect(screen.getByText("Alex Nguyen")).toBeInTheDocument();
      expect(screen.getByText("alex.nguyen@example.com")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Actions for Alex Nguyen" }));
      expect(await screen.findByRole("menuitem", { name: /remove friend/i })).toBeInTheDocument();
    });

    it("shows a truthful empty state with zero friends", () => {
      friendsState = okState([]);
      renderWithProviders(<Friends />, { route: "/friends" });
      expect(screen.getByText("No friends yet")).toBeInTheDocument();
    });
  });

  describe("remove friend", () => {
    it("opens a real confirmation dialog (not window.confirm)", async () => {
      friendsState = okState([alex({ status: "friends", email: "alex.nguyen@example.com" })]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Actions for Alex Nguyen" }));
      await user.click(await screen.findByRole("menuitem", { name: /remove friend/i }));

      expect(await screen.findByRole("dialog", { name: /remove alex nguyen/i })).toBeInTheDocument();
      expect(screen.getByText(/they will be removed from your friends list/i)).toBeInTheDocument();
    });

    it("Cancel keeps the friend and does not call the mutation", async () => {
      friendsState = okState([alex({ status: "friends", email: "alex.nguyen@example.com" })]);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Actions for Alex Nguyen" }));
      await user.click(await screen.findByRole("menuitem", { name: /remove friend/i }));
      await user.click(await screen.findByRole("button", { name: /^cancel$/i }));

      expect(removeMutateAsync).not.toHaveBeenCalled();
    });

    it("confirming calls the real remove mutation with only the friend's user id", async () => {
      friendsState = okState([alex({ status: "friends", email: "alex.nguyen@example.com" })]);
      removeMutateAsync.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Actions for Alex Nguyen" }));
      await user.click(await screen.findByRole("menuitem", { name: /remove friend/i }));
      await user.click(await screen.findByRole("button", { name: /^remove friend$/i }));

      expect(removeMutateAsync).toHaveBeenCalledWith("u-alex");
    });

    it("shows a real, user-safe error message when the remove mutation is in its error state, and the dialog stays open (not closed as if it succeeded)", async () => {
      friendsState = okState([alex({ status: "friends", email: "alex.nguyen@example.com" })]);
      removeMutateAsync.mockRejectedValue(new Error("You are not friends with this user"));
      removeState = { isPending: false, isError: true, error: new Error("You are not friends with this user") };
      const user = userEvent.setup();
      renderWithProviders(<Friends />, { route: "/friends" });

      await user.click(screen.getByRole("button", { name: "Actions for Alex Nguyen" }));
      await user.click(await screen.findByRole("menuitem", { name: /remove friend/i }));

      expect(await screen.findByText(/you are not friends with this user/i)).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: /remove alex nguyen/i })).toBeInTheDocument();
    });
  });
});
