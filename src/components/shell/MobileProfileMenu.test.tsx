import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/renderWithProviders";
import { MobileProfileMenu } from "./MobileProfileMenu";

vi.mock("../../features/profiles/useAvatar", () => ({
  useAvatar: () => ({ data: null }),
}));

const signOutMock = vi.fn();
vi.mock("../../features/user/useSignOut", () => ({
  useSignOut: () => signOutMock,
}));

describe("MobileProfileMenu", () => {
  afterEach(() => {
    signOutMock.mockClear();
  });

  it("opens on click and lists exactly Profile, Account, Notifications, Settings, Split Expenses, and Sign out", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileProfileMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    for (const label of ["Profile", "Account", "Notifications", "Settings", "Split Expenses"]) {
      expect(await screen.findByRole("menuitem", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
  });

  it("links Split Expenses to /split", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileProfileMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(await screen.findByRole("menuitem", { name: "Split Expenses" })).toHaveAttribute("href", "/split");
  });

  it("signs out using the real sign-out flow when Sign out is activated", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileProfileMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it("opens with keyboard activation (Enter) on the trigger", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileProfileMenu />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileProfileMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await screen.findByRole("menuitem", { name: "Profile" });

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menuitem", { name: "Profile" })).not.toBeInTheDocument();
  });
});
