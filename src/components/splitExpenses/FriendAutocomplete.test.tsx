import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FriendAutocomplete } from "./FriendAutocomplete";
import type { NexaliUserPreview } from "../../lib/friends";

function friend(overrides: Partial<NexaliUserPreview> = {}): NexaliUserPreview {
  return { id: "1", fullName: "Peter Nguyen", email: "peter@example.com", avatarUrl: null, status: "friends", ...overrides };
}

const FRIENDS: NexaliUserPreview[] = [
  friend({ id: "1", fullName: "Peter Nguyen", email: "peter@example.com" }),
  friend({ id: "2", fullName: "Paul Tran", email: "paul@example.com" }),
  friend({ id: "3", fullName: "Alex Pham", email: "alex@example.com" }),
  friend({ id: "4", fullName: "Sarah Le", email: "sarah@example.com" }),
];

function renderPicker(overrides: Partial<React.ComponentProps<typeof FriendAutocomplete>> = {}) {
  const onSelectFriend = vi.fn();
  const onAddManually = vi.fn();
  const onRetry = vi.fn();
  const utils = render(
    <FriendAutocomplete
      friends={FRIENDS}
      isLoading={false}
      isError={false}
      error={null}
      onRetry={onRetry}
      excludeIds={new Set(["you"])}
      onSelectFriend={onSelectFriend}
      onAddManually={onAddManually}
      {...overrides}
    />
  );
  return { ...utils, onSelectFriend, onAddManually, onRetry };
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /add person/i }));
}

describe("FriendAutocomplete", () => {
  afterEach(() => vi.clearAllMocks());

  it("the accepted Friends list populates the dropdown when opened", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);

    expect(screen.getByRole("option", { name: /peter nguyen/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /paul tran/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /alex pham/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /sarah le/i })).toBeInTheDocument();
  });

  it("shows each friend's email beneath their name (allowed -- these are accepted friends)", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);

    expect(screen.getByText("peter@example.com")).toBeInTheDocument();
  });

  it("never shows anyone outside the provided accepted-friends list (this is not the Friends-page search)", async () => {
    const user = userEvent.setup();
    renderPicker({ friends: [friend({ id: "1", fullName: "Peter Nguyen" })] });
    await open(user);

    expect(screen.getByRole("option", { name: /peter nguyen/i })).toBeInTheDocument();
    expect(screen.queryByText(/paul tran/i)).not.toBeInTheDocument();
  });

  it("excludes friends already selected in the current split", async () => {
    const user = userEvent.setup();
    renderPicker({ excludeIds: new Set(["you", "1"]) });
    await open(user);

    expect(screen.queryByRole("option", { name: /peter nguyen/i })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /paul tran/i })).toBeInTheDocument();
  });

  it('query "p" shows every friend with a name token starting with p (Peter, Paul, Alex Pham)', async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    await user.type(screen.getByRole("combobox"), "p");

    expect(screen.getByRole("option", { name: /peter nguyen/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /paul tran/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /alex pham/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /sarah le/i })).not.toBeInTheDocument();
  });

  it('query "P" (uppercase) returns the identical result set as "p"', async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    await user.type(screen.getByRole("combobox"), "P");

    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it('query "pe" narrows to only Peter Nguyen', async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    await user.type(screen.getByRole("combobox"), "pe");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /peter nguyen/i })).toBeInTheDocument();
  });

  it('query "n" matches Peter Nguyen by the LAST-NAME token, not just first names', async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    await user.type(screen.getByRole("combobox"), "n");

    expect(screen.getByRole("option", { name: /peter nguyen/i })).toBeInTheDocument();
  });

  it("a middle-of-word fragment does not match unless some token starts with it", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    await user.type(screen.getByRole("combobox"), "guy"); // mid-word in "Nguyen"

    expect(screen.queryByRole("option", { name: /peter nguyen/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no friends found/i)).toBeInTheDocument();
  });

  it("clearing the search restores every available friend", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    const input = screen.getByRole("combobox");
    await user.type(input, "pe");
    expect(screen.getAllByRole("option")).toHaveLength(1);

    await user.clear(input);
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("clicking a friend calls onSelectFriend with that real friend object", async () => {
    const user = userEvent.setup();
    const { onSelectFriend } = renderPicker();
    await open(user);
    await user.click(screen.getByRole("option", { name: /peter nguyen/i }));

    expect(onSelectFriend).toHaveBeenCalledWith(expect.objectContaining({ id: "1", fullName: "Peter Nguyen" }));
  });

  it("selecting a friend closes the dropdown and clears the query", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    await user.click(screen.getByRole("option", { name: /peter nguyen/i }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("an already-selected friend cannot appear twice -- excluded from the very next open", async () => {
    const user = userEvent.setup();
    renderPicker({ excludeIds: new Set(["you", "1"]) });
    await open(user);

    expect(screen.queryByRole("option", { name: /peter nguyen/i })).not.toBeInTheDocument();
  });

  it("shows a lightweight loading state while friends are loading, without blocking the trigger", async () => {
    const user = userEvent.setup();
    renderPicker({ isLoading: true, friends: undefined });
    await open(user);

    expect(screen.getByText(/loading your friends/i)).toBeInTheDocument();
  });

  it("shows a safe inline error with Retry when friends fail to load", async () => {
    const user = userEvent.setup();
    const { onRetry } = renderPicker({ isError: true, error: new Error("network down"), friends: undefined });
    await open(user);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows 'No friends found.' when the query matches nobody, distinct from the loading/error states", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    await user.type(screen.getByRole("combobox"), "zzz");

    expect(screen.getByText(/no friends found/i)).toBeInTheDocument();
  });

  it("offers 'Add someone manually' as a clearly separate secondary action", async () => {
    const user = userEvent.setup();
    const { onAddManually } = renderPicker();
    await open(user);
    await user.click(screen.getByRole("button", { name: /add someone manually/i }));

    expect(onAddManually).toHaveBeenCalled();
  });

  it("Escape closes the dropdown", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ArrowDown/Enter selects the active option via the keyboard", async () => {
    const user = userEvent.setup();
    const { onSelectFriend } = renderPicker();
    await open(user);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSelectFriend).toHaveBeenCalledWith(expect.objectContaining({ id: "2", fullName: "Paul Tran" }));
  });
});
