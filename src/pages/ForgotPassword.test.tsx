import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthError } from "@supabase/supabase-js";
import ForgotPassword from "./ForgotPassword";

vi.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

import { supabase } from "../supabaseClient";

type ResetResult = Awaited<ReturnType<typeof supabase.auth.resetPasswordForEmail>>;

function renderForgotPassword() {
  return render(
    <MemoryRouter initialEntries={["/forgot-password"]}>
      <ForgotPassword />
    </MemoryRouter>
  );
}

describe("ForgotPassword", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("submits the entered email to Supabase's reset flow, built from the app's own origin", async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    } as unknown as ResetResult);

    const user = userEvent.setup();
    renderForgotPassword();

    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await screen.findByText(/if an account exists/i);
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "jane@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/reset-password"),
      })
    );
  });

  it("shows a neutral success message regardless of whether the account exists", async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    } as unknown as ResetResult);

    const user = userEvent.setup();
    renderForgotPassword();

    await user.type(screen.getByLabelText(/email/i), "unknown@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    const success = await screen.findByText(/if an account exists for that email/i);
    expect(success).toBeInTheDocument();
    // The form itself is replaced by the confirmation, not left visible with a second signal.
    expect(screen.queryByRole("button", { name: /send reset link/i })).not.toBeInTheDocument();
  });

  it("shows a user-facing error when the request itself fails", async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: new AuthError("Email rate limit exceeded"),
    } as unknown as ResetResult);

    const user = userEvent.setup();
    renderForgotPassword();

    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  it("disables the submit button while the request is pending", async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockReturnValue(
      new Promise<ResetResult>(() => {})
    );

    const user = userEvent.setup();
    renderForgotPassword();

    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByRole("button", { name: /sending/i })).toBeDisabled();
  });
});
