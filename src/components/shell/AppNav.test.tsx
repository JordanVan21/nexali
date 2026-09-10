import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { AppNav } from "./AppNav";

vi.mock("../../features/profiles/useAvatar", () => ({
  useAvatar: () => ({ data: null }),
}));

describe("AppNav", () => {
  it("renders the primary destinations in order, with no Account and no search", () => {
    renderWithProviders(<AppNav />, { route: "/dashboard" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    // Every nav-item link carries an explicit aria-label; the logo link does not, so this
    // excludes the logo without depending on its accessible name.
    const links = within(primaryNav)
      .getAllByRole("link")
      .filter((el) => el.hasAttribute("aria-label"))
      .map((el) => el.getAttribute("aria-label"));

    // Dashboard, Transactions, Budgets, Reports, Aura, Notifications, Settings, in that order.
    expect(links).toEqual([
      "Dashboard",
      "Transactions",
      "Budgets",
      "Reports",
      "Aura",
      "Notifications",
      "Settings",
    ]);
    expect(links).not.toContain("Account");

    expect(within(primaryNav).queryByRole("searchbox")).not.toBeInTheDocument();
    expect(within(primaryNav).queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("gives Settings its own dedicated control, separate from the account menu", () => {
    renderWithProviders(<AppNav />, { route: "/dashboard" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    // Settings is reachable directly in the nav, not only inside the closed account dropdown.
    expect(within(primaryNav).getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("marks the current primary route active and leaves the others inactive", () => {
    renderWithProviders(<AppNav />, { route: "/budgets" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNav).getByRole("link", { name: "Budgets" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(primaryNav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("marks no primary destination active on a secondary page like Profile", () => {
    renderWithProviders(<AppNav />, { route: "/profile" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    for (const label of ["Dashboard", "Transactions", "Budgets", "Reports", "Aura"]) {
      expect(within(primaryNav).getByRole("link", { name: label })).not.toHaveAttribute(
        "aria-current"
      );
    }
  });

  it("marks the Settings control active on the Settings page", () => {
    renderWithProviders(<AppNav />, { route: "/settings" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNav).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("marks the Notifications control active on the Notifications page", () => {
    renderWithProviders(<AppNav />, { route: "/notifications" });

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primaryNav).getByRole("link", { name: "Notifications" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
