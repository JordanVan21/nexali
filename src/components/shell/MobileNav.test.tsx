import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { MobileNav } from "./MobileNav";

describe("MobileNav", () => {
  it("contains exactly five destinations, in order: Dashboard, Transactions, Budgets, Reports, Aura", () => {
    renderWithProviders(<MobileNav />, { route: "/dashboard" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    const links = within(bottomNav).getAllByRole("link");

    expect(links).toHaveLength(5);
    expect(links.map((el) => el.textContent)).toEqual([
      "Dashboard",
      "Transactions",
      "Budgets",
      "Reports",
      "Aura",
    ]);
  });

  it("does not render a More destination", () => {
    renderWithProviders(<MobileNav />, { route: "/dashboard" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    expect(within(bottomNav).queryByText(/more/i)).not.toBeInTheDocument();
    expect(within(bottomNav).queryAllByRole("button")).toHaveLength(0);
  });

  it("marks the current bottom-nav route active with aria-current", () => {
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

  it("marks Reports active on the reports route now that it is a primary bottom-nav destination", () => {
    renderWithProviders(<MobileNav />, { route: "/reports" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    expect(within(bottomNav).getByRole("link", { name: "Reports" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("marks Aura active on its route", () => {
    renderWithProviders(<MobileNav />, { route: "/assistant" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    expect(within(bottomNav).getByRole("link", { name: "Aura" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("does not falsely mark any primary destination active on a secondary account page", () => {
    renderWithProviders(<MobileNav />, { route: "/settings" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    for (const label of ["Dashboard", "Transactions", "Budgets", "Reports", "Aura"]) {
      expect(within(bottomNav).getByRole("link", { name: label })).not.toHaveAttribute(
        "aria-current"
      );
    }
  });

  it("keeps full, unabbreviated labels and wraps them safely instead of overlapping at narrow widths", () => {
    renderWithProviders(<MobileNav />, { route: "/dashboard" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    const transactionsLink = within(bottomNav).getByRole("link", { name: "Transactions" });

    // Label text is never abbreviated or hidden, even though all five
    // destinations must fit down to a 320px viewport.
    expect(transactionsLink).toHaveTextContent("Transactions");

    // A narrow-viewport font-size reduction exists so labels have room to
    // fit, and break-words on the label itself prevents any residual
    // overflow from spilling into a neighboring tab instead of wrapping.
    expect(transactionsLink.className).toContain("max-[340px]:text-[10px]");
    const label = within(transactionsLink).getByText("Transactions");
    expect(label.className).toContain("break-words");
    expect(label.className).toContain("text-center");
  });

  it("lays out five equal-width columns so all destinations remain visible at any phone width", () => {
    renderWithProviders(<MobileNav />, { route: "/dashboard" });

    const bottomNav = screen.getByRole("navigation", { name: "Bottom" });
    expect(bottomNav.className).toContain("grid-cols-5");
  });
});
