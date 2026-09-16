import { useState } from "react";
import { Search, Plus, MoreVertical, UsersRound } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { EmptyState } from "../components/states/EmptyState";
import { StatusBanner } from "../components/states/StatusBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdownMenu";
import { UserRow } from "../components/friends/UserRow";
import { FriendRequestNotificationCard } from "../components/friends/FriendRequestNotificationCard";
import { useFriends } from "../features/friends/useFriends";
import { MIN_SEARCH_QUERY_LENGTH, isExactEmailMatch } from "../lib/friends";
import type { NexaliUserPreview } from "../lib/friends";

/** Right-side content for one search result, based purely on its current FriendStatus -- no duplicate "send" affordance is ever shown once a request already exists. */
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
 * Friends -- FRONTEND ONLY (see docs/BACKEND_AUDIT_REPORT.md's Friends
 * entry). Every person, request, and friendship shown here lives in
 * useFriendsState()'s in-memory React state (seeded with mock demo data)
 * and is never read from or written to Supabase. Replaces the previous
 * "Friend management is coming soon" placeholder.
 */
export default function Friends() {
  const state = useFriends();
  const [removeTarget, setRemoveTarget] = useState<NexaliUserPreview | null>(null);

  const trimmedQuery = state.query.trim();
  const showResults = trimmedQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    await state.removeFriend(removeTarget.id);
    setRemoveTarget(null);
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
        {state.actionError && <StatusBanner variant="error">{state.actionError}</StatusBanner>}

        {state.incomingRequests.length > 0 && (
          <section aria-labelledby="friend-requests-heading">
            <h2 id="friend-requests-heading" className="mb-3 font-display text-lg font-semibold text-foreground">
              Friend Requests
            </h2>
            <ul className="flex flex-col gap-2">
              {state.incomingRequests.map((user) => (
                <FriendRequestNotificationCard
                  key={user.id}
                  user={user}
                  isPending={state.pendingUserId === user.id}
                  onAccept={() => void state.acceptRequest(user.id)}
                  onDecline={() => void state.declineRequest(user.id)}
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
              value={state.query}
              onChange={(e) => state.setQuery(e.target.value)}
              className="h-11 pl-9"
            />
          </div>

          {showResults && (
            <div role="region" aria-label="Search results" className="nexali-panel mt-3 rounded-xl p-2">
              {state.searchResults.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">No Nexali users found.</p>
              ) : (
                <ul className="divide-y divide-outline-variant/30">
                  {state.searchResults.map((user) => (
                    <li key={user.id} className="p-2.5">
                      <UserRow
                        user={user}
                        // Email is shown only when the ACTIVE query is an
                        // exact match for this person's email -- a partial
                        // name/email match can still find them, but must
                        // not reveal their full address (see
                        // lib/friends.ts's isExactEmailMatch doc comment).
                        // Recomputed from the live query on every render,
                        // so it stays correct even after this row's status
                        // changes (e.g. to "Request sent") without the
                        // query itself changing.
                        showEmail={isExactEmailMatch(trimmedQuery, user.email)}
                        action={
                          <SearchResultAction
                            user={user}
                            isPending={state.pendingUserId === user.id}
                            onSendRequest={() => void state.sendRequest(user.id)}
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
          {state.friends.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No friends yet"
              description="Search for people on Nexali to add your first friend."
            />
          ) : (
            <div className="nexali-panel rounded-xl p-2">
              <ul className="divide-y divide-outline-variant/30">
                {state.friends.map((user) => (
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
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={removeTarget ? `Remove ${removeTarget.fullName}?` : "Remove friend?"}
        description="They will be removed from your friends list."
        confirmLabel="Remove Friend"
        pendingLabel="Removing…"
        onConfirm={() => void handleConfirmRemove()}
        isPending={removeTarget != null && state.pendingUserId === removeTarget.id}
      />
    </PageContainer>
  );
}
