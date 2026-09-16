import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrendingUp } from "lucide-react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { NotificationItem } from "./NotificationItem";
import type { NotificationItemData } from "../../lib/notifications";

function fixture(overrides: Partial<NotificationItemData> = {}): NotificationItemData {
  return {
    id: "n1",
    type: "financial",
    icon: TrendingUp,
    title: "Groceries budget nearing limit",
    description: "You've used 88% of your Groceries budget for this month.",
    createdAt: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

describe("NotificationItem", () => {
  it("renders the real title, description and type label", () => {
    renderWithProviders(
      <ul>
        <NotificationItem notification={fixture()} onMarkRead={vi.fn()} onDismiss={vi.fn()} />
      </ul>
    );

    expect(screen.getByText("Groceries budget nearing limit")).toBeInTheDocument();
    expect(screen.getByText(/used 88% of your groceries budget/i)).toBeInTheDocument();
    expect(screen.getByText("Financial")).toBeInTheDocument();
  });

  it("shows an unread indicator and Mark as read action only when unread", () => {
    renderWithProviders(
      <ul>
        <NotificationItem notification={fixture({ read: false })} onMarkRead={vi.fn()} onDismiss={vi.fn()} />
      </ul>
    );

    expect(screen.getByText("(unread)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark as read/i })).toBeInTheDocument();
  });

  it("does not show an unread indicator or Mark as read action once read", () => {
    renderWithProviders(
      <ul>
        <NotificationItem notification={fixture({ read: true })} onMarkRead={vi.fn()} onDismiss={vi.fn()} />
      </ul>
    );

    expect(screen.queryByText("(unread)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as read/i })).not.toBeInTheDocument();
  });

  it("calls onMarkRead with the real notification id", async () => {
    const onMarkRead = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ul>
        <NotificationItem notification={fixture({ id: "n42" })} onMarkRead={onMarkRead} onDismiss={vi.fn()} />
      </ul>
    );

    await user.click(screen.getByRole("button", { name: /mark as read/i }));
    expect(onMarkRead).toHaveBeenCalledWith("n42");
  });

  it("calls onDismiss with the real notification id", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ul>
        <NotificationItem notification={fixture({ id: "n42", title: "Test" })} onMarkRead={vi.fn()} onDismiss={onDismiss} />
      </ul>
    );

    await user.click(screen.getByRole("button", { name: /dismiss notification: test/i }));
    expect(onDismiss).toHaveBeenCalledWith("n42");
  });

  it("renders primary/secondary actions as real router links only when provided", () => {
    renderWithProviders(
      <ul>
        <NotificationItem
          notification={fixture({ primaryAction: { label: "Review Budget", href: "/budgets" } })}
          onMarkRead={vi.fn()}
          onDismiss={vi.fn()}
        />
      </ul>
    );

    const link = screen.getByRole("link", { name: /review budget/i });
    expect(link).toHaveAttribute("href", "/budgets");
  });

  it("renders no action links when the notification has none", () => {
    renderWithProviders(
      <ul>
        <NotificationItem notification={fixture()} onMarkRead={vi.fn()} onDismiss={vi.fn()} />
      </ul>
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("renders inlineActions (Backend Part 8: non-navigation actions like Accept/Decline) as real buttons, not links", () => {
    const onAccept = vi.fn();
    renderWithProviders(
      <ul>
        <NotificationItem
          notification={fixture({ inlineActions: [{ label: "Accept", onClick: onAccept, variant: "hero" }] })}
          onMarkRead={vi.fn()}
          onDismiss={vi.fn()}
        />
      </ul>
    );

    const button = screen.getByRole("button", { name: "Accept" });
    expect(button).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Accept" })).not.toBeInTheDocument();
  });

  it("calls an inline action's own onClick, independent of onMarkRead/onDismiss", async () => {
    const onAccept = vi.fn();
    const onMarkRead = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ul>
        <NotificationItem
          notification={fixture({ inlineActions: [{ label: "Accept", onClick: onAccept }] })}
          onMarkRead={onMarkRead}
          onDismiss={vi.fn()}
        />
      </ul>
    );

    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it("renders multiple inline actions and respects each one's own disabled state", () => {
    renderWithProviders(
      <ul>
        <NotificationItem
          notification={fixture({
            inlineActions: [
              { label: "Decline", onClick: vi.fn(), disabled: true },
              { label: "Accept", onClick: vi.fn(), disabled: false },
            ],
          })}
          onMarkRead={vi.fn()}
          onDismiss={vi.fn()}
        />
      </ul>
    );

    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Accept" })).toBeEnabled();
  });

  it("renders no inline actions when the notification has none (existing action-less notifications unaffected)", () => {
    renderWithProviders(
      <ul>
        <NotificationItem notification={fixture()} onMarkRead={vi.fn()} onDismiss={vi.fn()} />
      </ul>
    );

    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
  });

  it("formats a real recent createdAt timestamp instead of a fabricated string", () => {
    const createdAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    renderWithProviders(
      <ul>
        <NotificationItem notification={fixture({ createdAt })} onMarkRead={vi.fn()} onDismiss={vi.fn()} />
      </ul>
    );

    expect(screen.getByText(/5 mins? ago/i)).toBeInTheDocument();
  });
});
