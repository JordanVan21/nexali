import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthApiError, AuthError } from "@supabase/supabase-js";
import VerifyEmail from "./VerifyEmail";

vi.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      resend: vi.fn(),
    },
  },
}));

import { supabase } from "../supabaseClient";

type AuthChangeCallback = Parameters<typeof supabase.auth.onAuthStateChange>[0];
type OnAuthStateChangeResult = ReturnType<typeof supabase.auth.onAuthStateChange>;
type GetSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
type ResendResult = Awaited<ReturnType<typeof supabase.auth.resend>>;

function mockAuthStateChange() {
  let callback: AuthChangeCallback = () => {};
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
    callback = cb;
    return {
      data: { subscription: { id: "sub", callback: cb, unsubscribe: vi.fn() } },
    } as unknown as OnAuthStateChangeResult;
  });
  return {
    fire: (event: string) => act(() => callback(event as never, null)),
  };
}

function renderVerifyEmail({ hash = "", email }: { hash?: string; email?: string } = {}) {
  window.location.hash = hash;
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/verify-email", state: email ? { email } : undefined }]}
    >
      <Routes>
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
        <Route path="/signin" element={<div>Sign in page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("VerifyEmail", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
  });

  it("shows a waiting state with the signed-up email when no session exists yet", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    mockAuthStateChange();

    renderVerifyEmail({ email: "jane@example.com" });

    expect(await screen.findByText(/jane@example.com/)).toBeInTheDocument();
  });

  it("shows a success state once Supabase reports a signed-in session", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    const { fire } = mockAuthStateChange();

    renderVerifyEmail({ email: "jane@example.com" });
    fire("SIGNED_IN");

    expect(await screen.findByRole("heading", { name: /email verified/i })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue to dashboard/i }));
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("shows an invalid-link message when Supabase reports an expired verification link", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    mockAuthStateChange();

    renderVerifyEmail({ hash: "#error=access_denied&error_code=otp_expired&error_description=x" });

    expect(await screen.findByText(/expired/i)).toBeInTheDocument();
  });

  it("resends the verification email and shows success feedback", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: null,
    } as unknown as ResendResult);
    mockAuthStateChange();

    const user = userEvent.setup();
    renderVerifyEmail({ email: "jane@example.com" });

    await user.click(await screen.findByRole("button", { name: /resend verification email/i }));

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "jane@example.com",
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    });
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();
  });

  it("disables further resends during the cooldown, preventing rapid repeated clicks", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: null,
    } as unknown as ResendResult);
    mockAuthStateChange();

    const user = userEvent.setup();
    renderVerifyEmail({ email: "jane@example.com" });

    const resendButton = await screen.findByRole("button", { name: /resend verification email/i });
    await user.click(resendButton);

    expect(supabase.auth.resend).toHaveBeenCalledTimes(1);
    const cooldownButton = await screen.findByRole("button", { name: /resend available in/i });
    expect(cooldownButton).toBeDisabled();

    await user.click(cooldownButton);
    expect(supabase.auth.resend).toHaveBeenCalledTimes(1);
  });

  it("shows a user-facing error when the resend request fails", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: new AuthError("Email rate limit exceeded"),
    } as unknown as ResendResult);
    mockAuthStateChange();

    const user = userEvent.setup();
    renderVerifyEmail({ email: "jane@example.com" });

    await user.click(await screen.findByRole("button", { name: /resend verification email/i }));

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  /**
   * Regression coverage for the 2026-09-16 auth/email-verification
   * investigation. Root cause was NOT a swallowed-error bug (resendVerificationEmail
   * already checked `error` and threw correctly) -- but two real, separate
   * defects were found and fixed alongside it: the frontend's resend
   * cooldown (30s) was shorter than the linked Supabase project's real
   * `auth.email.max_frequency` (60s, confirmed via `npx supabase config
   * diff`), and `resendVerificationEmail()` omitted `emailRedirectTo`
   * entirely, disagreeing with `signUp()`'s.
   */
  describe("auth/email-verification investigation regression coverage (2026-09-16)", () => {
    it("starts a 60-second cooldown after a real successful resend, matching the linked project's confirmed 60s auth.email.max_frequency (not the old 30s value)", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
      } as unknown as GetSessionResult);
      vi.mocked(supabase.auth.resend).mockResolvedValue({
        data: {},
        error: null,
      } as unknown as ResendResult);
      mockAuthStateChange();

      const user = userEvent.setup();
      renderVerifyEmail({ email: "jane@example.com" });

      await user.click(await screen.findByRole("button", { name: /resend verification email/i }));

      expect(await screen.findByRole("button", { name: "Resend available in 60s" })).toBeInTheDocument();
    });

    it("resend always uses the real emailRedirectTo option, agreeing with signUp()'s redirect target", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
      } as unknown as GetSessionResult);
      vi.mocked(supabase.auth.resend).mockResolvedValue({
        data: {},
        error: null,
      } as unknown as ResendResult);
      mockAuthStateChange();

      const user = userEvent.setup();
      renderVerifyEmail({ email: "jane@example.com" });

      await user.click(await screen.findByRole("button", { name: /resend verification email/i }));

      const [call] = vi.mocked(supabase.auth.resend).mock.calls;
      expect(call[0]).toMatchObject({ options: { emailRedirectTo: `${window.location.origin}/verify-email` } });
    });

    it("a real Supabase rate-limit error (over_email_send_rate_limit code) shows a safe message, never a false success", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
      } as unknown as GetSessionResult);
      vi.mocked(supabase.auth.resend).mockResolvedValue({
        data: {},
        error: new AuthApiError(
          "For security purposes, you can only request this after 46 seconds.",
          429,
          "over_email_send_rate_limit"
        ),
      } as unknown as ResendResult);
      mockAuthStateChange();

      const user = userEvent.setup();
      renderVerifyEmail({ email: "jane@example.com" });

      await user.click(await screen.findByRole("button", { name: /resend verification email/i }));

      expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
      expect(screen.queryByText(/verification email sent/i)).not.toBeInTheDocument();
      // The raw GoTrue message text must never reach the user directly.
      expect(screen.queryByText(/46 seconds/i)).not.toBeInTheDocument();
    });

    it("a network failure (resend rejects instead of resolving) shows a safe error, never a raw exception or a false success", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
      } as unknown as GetSessionResult);
      vi.mocked(supabase.auth.resend).mockRejectedValue(new TypeError("Failed to fetch"));
      mockAuthStateChange();

      const user = userEvent.setup();
      renderVerifyEmail({ email: "jane@example.com" });

      await user.click(await screen.findByRole("button", { name: /resend verification email/i }));

      expect(screen.queryByText(/verification email sent/i)).not.toBeInTheDocument();
      expect(await screen.findByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
    });

    it("resend targets whatever email is currently displayed in the field, not a stale value from signup state", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
      } as unknown as GetSessionResult);
      vi.mocked(supabase.auth.resend).mockResolvedValue({
        data: {},
        error: null,
      } as unknown as ResendResult);
      mockAuthStateChange();

      const user = userEvent.setup();
      renderVerifyEmail({ email: "old-signup-email@example.com" });

      const emailField = await screen.findByLabelText(/email address/i);
      await user.clear(emailField);
      await user.type(emailField, "corrected@example.com");
      await user.click(screen.getByRole("button", { name: /resend verification email/i }));

      expect(supabase.auth.resend).toHaveBeenCalledWith(
        expect.objectContaining({ email: "corrected@example.com" })
      );
    });

    it("prevents a second resend while the first is still in flight, before any cooldown state applies", async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
      } as unknown as GetSessionResult);
      let resolveResend!: (value: ResendResult) => void;
      vi.mocked(supabase.auth.resend).mockReturnValue(
        new Promise((resolve) => {
          resolveResend = resolve;
        }) as unknown as ReturnType<typeof supabase.auth.resend>
      );
      mockAuthStateChange();

      const user = userEvent.setup();
      renderVerifyEmail({ email: "jane@example.com" });

      const resendButton = await screen.findByRole("button", { name: /resend verification email/i });
      await user.click(resendButton);
      expect(await screen.findByRole("button", { name: "Sending…" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Sending…" }));
      expect(supabase.auth.resend).toHaveBeenCalledTimes(1);

      resolveResend({ data: {}, error: null } as unknown as ResendResult);
      expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();
    });
  });

  it("uses the real link-based verification flow, never a fake 6-digit code UI", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    mockAuthStateChange();

    renderVerifyEmail({ email: "jane@example.com" });

    expect(await screen.findByText(/confirmation link/i)).toBeInTheDocument();
    expect(screen.queryByText(/6-digit/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("textbox").length).toBeLessThanOrEqual(1);
  });
});
