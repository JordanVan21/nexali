import * as React from "react";
import { UserPlus, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ProfileAvatar } from "../ProfileAvatar";
import { cn, getErrorMessage } from "../../lib/utils";
import { filterFriendsByNameQuery } from "../../lib/friendNameSearch";
import type { NexaliUserPreview } from "../../lib/friends";

/**
 * Replaces the old "type a name to create a temporary person" Add Person
 * flow with a searchable dropdown of the user's REAL accepted Nexali
 * friends -- follows the same hand-rolled trigger-button + absolutely
 * positioned panel pattern already established by CategoryPicker.tsx
 * (click-outside/Escape-to-close, autofocus search input), rather than
 * introducing a new combobox dependency/pattern.
 *
 * This is NOT the Friends-page user search: it only ever shows
 * `friends` (accepted friends, from the same cached useListFriends() query
 * the /friends page uses -- no second Friends fetch implementation), never
 * strangers or pending requests, and filtering is entirely local/instant
 * (see lib/friendNameSearch.ts) since the full accepted-friends list is
 * already loaded.
 */
export function FriendAutocomplete({
  friends,
  isLoading,
  isError,
  error,
  onRetry,
  excludeIds,
  onSelectFriend,
  onAddManually,
}: {
  friends: NexaliUserPreview[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  /** Ids already in the current split -- excluded from results so a friend can never be selected twice. */
  excludeIds: Set<string>;
  onSelectFriend: (friend: NexaliUserPreview) => void;
  onAddManually: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const available = React.useMemo(
    () => (friends ?? []).filter((f) => !excludeIds.has(f.id)),
    [friends, excludeIds]
  );
  const filtered = React.useMemo(() => filterFriendsByNameQuery(available, query), [available, query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function selectFriend(friend: NexaliUserPreview) {
    onSelectFriend(friend);
    close();
    triggerRef.current?.focus();
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const friend = filtered[activeIndex];
      if (friend) selectFriend(friend);
    }
  }

  const listboxId = "friend-autocomplete-listbox";

  return (
    <div className="relative" ref={containerRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="surface"
        size="sm"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Add Person
        <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-outline-variant bg-popover shadow-lg">
          <div className="p-2">
            <label htmlFor="friend-autocomplete-input" className="sr-only">
              Search your friends
            </label>
            <Input
              id="friend-autocomplete-input"
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search your friends…"
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              className="h-10"
            />
          </div>

          <div id={listboxId} role="listbox" aria-label="Accepted friends" className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <p className="px-3 py-3 text-sm text-muted-foreground" aria-busy="true">
                Loading your friends…
              </p>
            ) : isError ? (
              <div className="px-3 py-3">
                <p role="alert" className="mb-2 text-sm text-destructive">
                  {getErrorMessage(error, "Couldn't load your friends.")}
                </p>
                <Button type="button" variant="surface" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">No friends found.</p>
            ) : (
              filtered.map((friend, index) => (
                <button
                  key={friend.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectFriend(friend)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                    index === activeIndex ? "bg-accent" : "hover:bg-accent"
                  )}
                >
                  <ProfileAvatar name={friend.fullName} email={friend.email} imageUrl={friend.avatarUrl} className="h-8 w-8 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{friend.fullName}</span>
                    {friend.email && <span className="block truncate text-xs text-muted-foreground">{friend.email}</span>}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-outline-variant/40 p-1">
            <button
              type="button"
              onClick={() => {
                close();
                onAddManually();
              }}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Add someone manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
