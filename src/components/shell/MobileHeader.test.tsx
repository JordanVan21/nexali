import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { MobileHeader } from "./MobileHeader";

vi.mock("../../features/profiles/useAvatar", () => ({
  useAvatar: () => ({ data: null }),
}));

describe("MobileHeader", () => {
  it("renders the Nexali brand link on the left", () => {
    renderWithProviders(<MobileHeader />);

    const brandLink = screen.getByRole("link", { name: "Nexali home" });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute("href", "/dashboard");
  });

  it("renders the account menu trigger, with no standalone Notifications or Settings icon", () => {
    renderWithProviders(<MobileHeader />);

    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /notifications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
  });

  it("does not render a hamburger menu trigger", () => {
    renderWithProviders(<MobileHeader />);

    expect(screen.queryByRole("button", { name: /open menu/i })).not.toBeInTheDocument();
  });
});
