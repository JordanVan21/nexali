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

  it("keeps full, unabbreviated labels and wraps them safely instead of overlapping at narrow widths", () => {
    renderWithProviders(<MobileNav />, { route: "/dashboard" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    const transactionsLink = within(bottomNav).getByRole("link", { name: "Transactions" });

    // Label text is never abbreviated or hidden.
    expect(transactionsLink).toHaveTextContent("Transactions");

    // A narrow-viewport font-size reduction exists so labels have room to fit,
    // and break-words on the label itself prevents any residual overflow from
    // spilling into a neighboring tab instead of wrapping within its own box.
    expect(transactionsLink.className).toContain("max-[340px]:text-[10px]");
    const label = within(transactionsLink).getByText("Transactions");
    expect(label.className).toContain("break-words");
    expect(label.className).toContain("text-center");
  });

  it("does not change label sizing classes above the narrow-width cutoff", () => {
    renderWithProviders(<MobileNav />, { route: "/dashboard" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    const dashboardLink = within(bottomNav).getByRole("link", { name: "Dashboard" });

    // The base (375px+) text size and spacing are unchanged; only a
    // max-[340px] variant was added alongside them.
    expect(dashboardLink.className).toContain("text-xs");
    expect(dashboardLink.className).toContain("gap-1");
  });
});
