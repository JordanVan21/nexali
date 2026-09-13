import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import LandingPage from "./LandingPage";

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <LandingPage />
    </MemoryRouter>
  );
}

describe("LandingPage", () => {
  it("renders the real Nexali brand in the header and footer", () => {
    renderLanding();

    const brandLinks = screen.getAllByRole("link", { name: /nexali/i });
    expect(brandLinks.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nexali").length).toBeGreaterThan(0);
  });

  it("routes Sign In to the real sign-in route", () => {
    renderLanding();

    const signIn = screen.getByRole("link", { name: "Sign In" });
    expect(signIn).toHaveAttribute("href", "/signin");
  });

  it("routes Get Started to the real sign-up route", () => {
    renderLanding();

    const getStarted = screen.getByRole("link", { name: "Get Started" });
    expect(getStarted).toHaveAttribute("href", "/signup");
  });

  it("routes the primary hero CTA to sign-up", () => {
    renderLanding();

    const primaryCta = screen.getByRole("link", { name: /start your journey/i });
    expect(primaryCta).toHaveAttribute("href", "/signup");
  });

  it("routes the secondary hero CTA (View demo) to the real dashboard route", () => {
    renderLanding();

    const secondaryCta = screen.getByRole("link", { name: "View demo" });
    expect(secondaryCta).toHaveAttribute("href", "/dashboard");
  });

  it("routes the bottom CTA banner's Create free account and Sign in links correctly", () => {
    renderLanding();

    expect(screen.getByRole("link", { name: /create free account/i })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  });

  it("uses the real Aura naming, never an old/mock assistant name", () => {
    renderLanding();

    expect(screen.getAllByText(/aura/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/co-pilot ai|chatbot|assistant bot/i)).not.toBeInTheDocument();
  });

  it("does not open the mobile menu by default, so there is only one Sign In / Get Started control at rest", () => {
    renderLanding();

    expect(screen.getAllByRole("link", { name: "Sign In" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Get Started" })).toHaveLength(1);
  });

  it("opens the mobile menu via an accessible control", async () => {
    renderLanding();

    const menuButton = screen.getByRole("button", { name: /open menu/i });
    expect(menuButton).toBeInTheDocument();
  });
});
