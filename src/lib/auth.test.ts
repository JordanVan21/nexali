import { describe, it, expect, vi, afterEach } from "vitest";
import { requestPasswordReset, resendVerificationEmail, signUp } from "./auth";

vi.mock("../supabaseClient", () => ({
  supabase: { auth: { signUp: vi.fn(), resend: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), signInWithPassword: vi.fn() } },
}));

import { supabase } from "../supabaseClient";

describe("signUp", () => {
  afterEach(() => vi.clearAllMocks());

  it("passes emailRedirectTo back into this app's own /verify-email route, never a hardcoded host", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: null, session: null }, error: null } as never);
    await signUp("Jane Doe", "jane@example.com", "password123");

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "password123",
      options: {
        data: { full_name: "Jane Doe" },
        emailRedirectTo: `${window.location.origin}/verify-email`,
      },
    });
  });

  it("throws the real Supabase error rather than swallowing it", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: null, error: { message: "User already registered" } } as never);
    await expect(signUp("Jane Doe", "jane@example.com", "password123")).rejects.toBeTruthy();
  });
});

describe("resendVerificationEmail", () => {
  afterEach(() => vi.clearAllMocks());

  /**
   * Regression coverage for the 2026-09-16 auth/email-verification
   * investigation: resendVerificationEmail() previously omitted
   * emailRedirectTo entirely, so any real confirmation link it did send
   * would fall back to the project's Site URL instead of agreeing with
   * signUp()'s /verify-email redirect. Both must now match exactly.
   */
  it("uses the real signup resend type and the exact same emailRedirectTo as signUp()", async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({ data: {}, error: null } as never);
    await resendVerificationEmail("jane@example.com");

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "jane@example.com",
      options: {
        emailRedirectTo: `${window.location.origin}/verify-email`,
      },
    });
  });

  it("checks the returned error and throws it -- does not treat every resolved promise as success", async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: { message: "For security purposes, you can only request this after 46 seconds." },
    } as never);

    await expect(resendVerificationEmail("jane@example.com")).rejects.toBeTruthy();
  });

  it("resolves without throwing when Supabase reports no error", async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({ data: {}, error: null } as never);
    await expect(resendVerificationEmail("jane@example.com")).resolves.toBeUndefined();
  });
});

describe("requestPasswordReset", () => {
  afterEach(() => vi.clearAllMocks());

  it("redirects to this app's own /reset-password route", async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null } as never);
    await requestPasswordReset("jane@example.com");

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("jane@example.com", {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it("throws the real Supabase error rather than swallowing it", async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: null, error: { message: "over_email_send_rate_limit" } } as never);
    await expect(requestPasswordReset("jane@example.com")).rejects.toBeTruthy();
  });
});
