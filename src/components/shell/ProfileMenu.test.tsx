import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ProfileMenu } from "./ProfileMenu";

vi.mock("../../features/profiles/useAvatar", () => ({
  useAvatar: () => ({ data: null }),
}));

const signOutMock = vi.fn();
vi.mock("../../features/user/useSignOut", () => ({
  useSignOut: () => signOutMock,
}));

describe("ProfileMenu", () => {
  afterEach(() => {
    signOutMock.mockClear();
  });

  it("opens on click and lists Profile, Account, and Sign out, with no duplicate Settings", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfileMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    expect(await screen.findByRole("menuitem", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /account/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /settings/i })).not.toBeInTheDocument();
  });

  it("opens with keyboard activation (Enter) on the trigger", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfileMenu />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: /profile/i })).toBeInTheDocument();
  });

  it("signs out when Sign out is activated", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfileMenu />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
