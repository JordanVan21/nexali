import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { MobileNav } from "./MobileNav";

vi.mock("../../features/user/useSignOut", () => ({
  useSignOut: () => vi.fn(),
}));

describe("MobileNav", () => {
  it("contains exactly Dashboard, Transactions, Budgets, Aura, and More, in that order", () => {
    renderWithProviders(<MobileNav />, { route: "/dashboard" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    const items = within(bottomNav)
      .getAllByRole("link")
      .concat(within(bottomNav).getAllByRole("button"));

    const names = items.map((el) => el.getAttribute("aria-label") ?? el.textContent);
    expect(names).toEqual(["Dashboard", "Transactions", "Budgets", "Aura", "More"]);
  });

  it("marks the current bottom-nav route active", () => {
    renderWithProviders(<MobileNav />, { route: "/transactions" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    expect(within(bottomNav).getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(bottomNav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("highlights More, not any tab, when a secondary route (Reports) is active", () => {
    renderWithProviders(<MobileNav />, { route: "/reports" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    const moreButton = within(bottomNav).getByRole("button", { name: "More" });
    expect(moreButton.className).toContain("text-primary");

    for (const label of ["Dashboard", "Transactions", "Budgets", "Aura"]) {
      expect(within(bottomNav).getByRole("link", { name: label })).not.toHaveAttribute(
        "aria-current"
      );
    }
  });

  it("does not highlight More when a bottom-nav route is active", () => {
    renderWithProviders(<MobileNav />, { route: "/budgets" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    const moreButton = within(bottomNav).getByRole("button", { name: "More" });
    expect(moreButton.className).not.toContain("text-primary");
  });
});
