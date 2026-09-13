import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Assistant from "./Assistant";

let profileState: { data?: { full_name: string | null }; isLoading: boolean; isError: boolean };

vi.mock("../features/profiles/useProfile", () => ({
  useProfile: () => profileState,
}));

function resetToDefaults() {
  profileState = { data: { full_name: "Jordan Rivera" }, isLoading: false, isError: false };
}

describe("Assistant (Aura) page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Aura identity and a personalized welcome using real (already-available) profile data", () => {
    resetToDefaults();
    renderWithProviders(<Assistant />);

    expect(screen.getByRole("heading", { name: "Aura", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Hello, Jordan. I'm Aura.")).toBeInTheDocument();
  });

  it("renders fine without requiring profile data to have loaded", () => {
    profileState = { data: undefined, isLoading: true, isError: false };
    renderWithProviders(<Assistant />);

    expect(screen.getByText("Hello. I'm Aura.")).toBeInTheDocument();
  });

  it("renders read-only-appropriate starter questions with no write-action language", () => {
    resetToDefaults();
    renderWithProviders(<Assistant />);

    expect(screen.getByRole("button", { name: "How is my budget going?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add a transaction/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("populates the composer when a starter question is selected, without submitting it", async () => {
    resetToDefaults();
    const user = userEvent.setup();
    renderWithProviders(<Assistant />);

    await user.click(screen.getByRole("button", { name: "How is my budget going?" }));

    const input = screen.getByLabelText(/ask aura anything about your finances/i);
    expect(input).toHaveValue("How is my budget going?");
    // Selecting a prompt must not itself create any message.
    expect(screen.queryByText("How is my budget going?", { selector: "p" })).not.toBeInTheDocument();
  });

  it("shows the real user's typed message plus an honest not-connected notice on Send — never a fabricated answer", async () => {
    resetToDefaults();
    const user = userEvent.setup();
    renderWithProviders(<Assistant />);

    const input = screen.getByLabelText(/ask aura anything about your finances/i);
    await user.type(input, "How much did I spend this month?");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(screen.getByText("How much did I spend this month?", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/being connected to your financial data/i)).toBeInTheDocument();
    // No dollar figure or percentage is ever fabricated in the response.
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("clears the composer after sending", async () => {
    resetToDefaults();
    const user = userEvent.setup();
    renderWithProviders(<Assistant />);

    const input = screen.getByLabelText(/ask aura anything about your finances/i);
    await user.type(input, "Test question");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(input).toHaveValue("");
  });

  it("never shows a pre-seeded conversation or mock financial values by default", () => {
    resetToDefaults();
    renderWithProviders(<Assistant />);

    expect(screen.queryByText(/spending breakdown/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/38%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/connected accounts/i)).not.toBeInTheDocument();
  });

  it("does not use window.alert for the Send action", async () => {
    resetToDefaults();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    renderWithProviders(<Assistant />);

    await user.type(screen.getByLabelText(/ask aura anything about your finances/i), "Hi");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
