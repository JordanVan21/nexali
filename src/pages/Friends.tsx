import { useState } from "react";
import { Search, Plus, MoreVertical, UsersRound } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { Skeleton } from "../components/states/Skeleton";
import { StatusBanner } from "../components/states/StatusBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdownMenu";
import { UserRow } from "../components/friends/UserRow";
import { FriendRequestNotificationCard } from "../components/friends/FriendRequestNotificationCard";
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useListFriends,
  useListIncomingFriendRequests,
  useRemoveFriend,
  useSearchNexaliUsers,
  useSendFriendRequest,
} from "../features/friends/useFriendsQueries";
import { useUserInfo } from "../shared/useUserId";
import { getErrorMessage } from "../lib/utils";
import { MIN_SEARCH_QUERY_LENGTH } from "../lib/friends";
import type { NexaliUserPreview } from "../lib/friends";

/** Right-side content for one search result, based purely on its server-returned relationship_status -- no duplicate "send" affordance is ever shown once a request already exists. */
function SearchResultAction({
  user,
  isPending,
  onSendRequest,
}: {
  user: NexaliUserPreview;
  isPending: boolean;
  onSendRequest: () => void;
}) {
  switch (user.status) {
    case "none":
      return (
        <Button
          type="button"
          variant="surface"
          size="icon"
          aria-label={`Send friend request to ${user.fullName}`}
          onClick={onSendRequest}
          disabled={isPending}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      );
    case "outgoing_pending":
      return <span className="text-xs font-medium text-muted-foreground">Request sent</span>;
    case "incoming_pending":
      return <span className="text-xs font-medium text-muted-foreground">Request pending</span>;
    case "friends":
      return <span className="text-xs font-medium text-success">Friends</span>;
  }
}

/**
 * Friends -- real, Supabase-backed (Backend Part 8). Search, incoming
 * requests, the friends list, and every action (send/accept/decline/
 * remove) go through the RPCs in lib/friendsData.ts -- see
 * docs/BACKEND_AUDIT_REPORT.md's Friends entry for the full backend
 * writeup. Replaces the prior frontend-only mock-state version.
 */
export default function Friends() {
  const { userId } = useUserInfo();
  const [query, setQuery] = useState("");
  const [removeTarget, setRemoveTarget] = useState<NexaliUserPreview | null>(null);

  const trimmedQuery = query.trim();
  const showResults = trimmedQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  const searchQuery = useSearchNexaliUsers(userId, query);
  const friendsQuery = useListFriends(userId);
  const incomingQuery = useListIncomingFriendRequests(userId);

  const sendRequest = useSendFriendRequest(userId);
  const acceptRequest = useAcceptFriendRequest(userId);
  const declineRequest = useDeclineFriendRequest(userId);
  const removeFriendMut = useRemoveFriend(userId);

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    try {
      await removeFriendMut.mutateAsync(removeTarget.id);
      setRemoveTarget(null);
    } catch {
      // Dialog stays open and shows the real error -- see errorMessage below.
    }
  }

  return (
    <PageContainer>
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[36px] lg:text-[44px] xl:text-[48px]">
          Friends
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground sm:text-base lg:text-lg xl:text-xl">
          Find people on Nexali and manage your friends.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-[900px] space-y-6 md:mt-8 md:space-y-8">
        {acceptRequest.isError && (
          <StatusBanner variant="error">{getErrorMessage(acceptRequest.error, "Couldn't accept friend request.")}</StatusBanner>
        )}
        {declineRequest.isError && (
          <StatusBanner variant="error">{getErrorMessage(declineRequest.error, "Couldn't decline friend request.")}</StatusBanner>
        )}

        {(incomingQuery.data?.length ?? 0) > 0 && (
          <section aria-labelledby="friend-requests-heading">
            <h2 id="friend-requests-heading" className="mb-3 font-display text-lg font-semibold text-foreground">
              Friend Requests
            </h2>
            <ul className="flex flex-col gap-2">
              {incomingQuery.data!.map((req) => (
                <FriendRequestNotificationCard
                  key={req.requestId}
                  user={{ id: req.senderId, fullName: req.senderFullName, email: null, avatarUrl: req.senderAvatarUrl, status: "incoming_pending" }}
                  isPending={
                    (acceptRequest.isPending && acceptRequest.variables === req.requestId) ||
                    (declineRequest.isPending && declineRequest.variables === req.requestId)
                  }
                  onAccept={() => void acceptRequest.mutate(req.requestId)}
                  onDecline={() => void declineRequest.mutate(req.requestId)}
                />
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="find-people-heading">
          <h2 id="find-people-heading" className="mb-3 font-display text-lg font-semibold text-foreground">
            Find People
          </h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="friends-search" className="sr-only">
              Search Nexali users
            </label>
            <Input
              id="friends-search"
              type="search"
              placeholder="Search Nexali users…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-9"
            />
          </div>

          {showResults && (
            <div role="region" aria-label="Search results" className="nexali-panel mt-3 rounded-xl p-2">
              {searchQuery.isLoading ? (
                <div className="space-y-2 p-1" aria-busy="true" aria-label="Searching Nexali users">
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                </div>
              ) : searchQuery.isError ? (
                <div className="p-2">
                  <p role="alert" className="px-1 py-2 text-sm text-destructive">
                    {getErrorMessage(searchQuery.error, "Couldn't search Nexali users.")}
                  </p>
                  <Button type="button" variant="surface" size="sm" onClick={() => searchQuery.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : searchQuery.data && searchQuery.data.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">No Nexali users found.</p>
              ) : (
                <ul className="divide-y divide-outline-variant/30">
                  {(searchQuery.data ?? []).map((user) => (
                    <li key={user.id} className="p-2.5">
                      <UserRow
                        user={user}
                        // Server-enforced: `user.email` is already null for
                        // every non-exact-email-match result (see
                        // search_nexali_users()'s SQL) -- the frontend only
                        // decides whether to render the row, never whether
                        // to reveal a value it already has.
                        showEmail={user.email != null}
                        action={
                          <SearchResultAction
                            user={user}
                            isPending={sendRequest.isPending && sendRequest.variables === user.id}
                            onSendRequest={() => void sendRequest.mutate(user.id)}
                          />
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="your-friends-heading">
          <h2 id="your-friends-heading" className="mb-3 font-display text-lg font-semibold text-foreground">
            Your Friends
          </h2>
          {friendsQuery.isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading your friends">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : friendsQuery.isError ? (
            <ErrorState
              title="Couldn't load your friends"
              message={getErrorMessage(friendsQuery.error, "Please check your connection and try again.")}
              onRetry={() => friendsQuery.refetch()}
            />
          ) : friendsQuery.data && friendsQuery.data.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No friends yet"
              description="Search for people on Nexali to add your first friend."
            />
          ) : (
            <div className="nexali-panel rounded-xl p-2">
              <ul className="divide-y divide-outline-variant/30">
                {(friendsQuery.data ?? []).map((user) => (
                  <li key={user.id} className="p-2.5">
                    <UserRow
                      user={user}
                      action={
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Actions for ${user.fullName}`}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setRemoveTarget(user)}
                              className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
                            >
                              Remove Friend
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
            removeFriendMut.reset();
          }
        }}
        title={removeTarget ? `Remove ${removeTarget.fullName}?` : "Remove friend?"}
        description="They will be removed from your friends list."
        confirmLabel="Remove Friend"
        pendingLabel="Removing…"
        onConfirm={() => void handleConfirmRemove()}
        isPending={removeFriendMut.isPending}
        errorMessage={removeFriendMut.isError ? getErrorMessage(removeFriendMut.error, "Couldn't remove friend.") : null}
      />
    </PageContainer>
  );
}
