import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/renderWithProviders";
import { MobileMenu } from "./MobileMenu";

const signOutMock = vi.fn();
vi.mock("../../features/user/useSignOut", () => ({
  useSignOut: () => signOutMock,
}));

describe("MobileMenu", () => {
  afterEach(() => {
    signOutMock.mockClear();
  });

  it("opens on hamburger click and lists every destination, including Reports, plus Sign out", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileMenu />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    const nav = await screen.findByRole("navigation", { name: "Mobile" });
    for (const label of [
      "Dashboard",
      "Transactions",
      "Budgets",
      "Reports",
      "Aura",
      "Notifications",
      "Profile",
      "Account",
      "Settings",
    ]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("closes after a navigation link is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileMenu />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const nav = await screen.findByRole("navigation", { name: "Mobile" });
    await user.click(within(nav).getByRole("link", { name: "Reports" }));

    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "Mobile" })).not.toBeInTheDocument();
    });
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileMenu />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await screen.findByRole("navigation", { name: "Mobile" });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "Mobile" })).not.toBeInTheDocument();
    });
  });

  it("signs out and closes when Sign out is activated", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileMenu />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(await screen.findByRole("button", { name: /sign out/i }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
