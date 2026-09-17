import { describe, it, expect, afterEach } from "vitest";
import { AuthApiError, AuthError } from "@supabase/supabase-js";
import { normalizeAuthError, getAuthHashError, isExpiredAuthHashError } from "./authErrors";

describe("normalizeAuthError", () => {
  it("returns the fallback for a falsy error", () => {
    expect(normalizeAuthError(null, "fallback text")).toBe("fallback text");
  });

  /**
   * Regression coverage for the 2026-09-16 auth/email-verification
   * investigation: GoTrue's real rate-limit error code, confirmed present
   * in the installed @supabase/auth-js's own error-codes.d.ts, is
   * `over_email_send_rate_limit` -- and its real message text ("For
   * security purposes, you can only request this after 46 seconds.")
   * does NOT contain the words "rate limit" or "too many requests" that
   * the substring-matching branches below look for. The code-based check
   * must catch this regardless of message wording, and must never leak
   * the raw GoTrue text (which could reveal exactly how many seconds are
   * left, a minor information leak) to the user.
   */
  it("maps a real over_email_send_rate_limit error code to a safe message, regardless of message wording", () => {
    const error = new AuthApiError(
      "For security purposes, you can only request this after 46 seconds.",
      429,
      "over_email_send_rate_limit"
    );
    const result = normalizeAuthError(error);
    expect(result).toMatch(/too many attempts/i);
    expect(result).not.toMatch(/46 seconds/);
  });

  it("maps over_sms_send_rate_limit and over_request_rate_limit the same way", () => {
    expect(normalizeAuthError(new AuthApiError("x", 429, "over_sms_send_rate_limit"))).toMatch(/too many attempts/i);
    expect(normalizeAuthError(new AuthApiError("x", 429, "over_request_rate_limit"))).toMatch(/too many attempts/i);
  });

  it("still falls back to message-text matching for a rate-limit error with no code (older/unknown error shapes)", () => {
    expect(normalizeAuthError(new AuthError("Email rate limit exceeded"))).toMatch(/too many attempts/i);
  });

  it("maps invalid login credentials to a generic, non-enumerating message", () => {
    expect(normalizeAuthError(new Error("Invalid login credentials"))).toBe("Incorrect email or password.");
  });

  it("maps an already-registered signup error to a safe, actionable message", () => {
    expect(normalizeAuthError(new Error("User already registered"))).toMatch(/already exists/i);
  });

  it("passes through Supabase's own short password-policy message verbatim", () => {
    const message = "Password should be at least 6 characters.";
    expect(normalizeAuthError(new Error(message))).toBe(message);
  });

  it("never returns a raw, unmapped exception message -- falls back to the safe default instead", () => {
    const result = normalizeAuthError(new Error("relation \"public.profiles\" does not exist"), "Something went wrong.");
    expect(result).toBe("Something went wrong.");
  });
});

describe("getAuthHashError / isExpiredAuthHashError", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("returns null when the hash has no error params", () => {
    window.location.hash = "";
    expect(getAuthHashError()).toBeNull();
  });

  it("parses an expired-link hash error", () => {
    window.location.hash = "#error=access_denied&error_code=otp_expired&error_description=Link+expired";
    const hashError = getAuthHashError();
    expect(hashError).not.toBeNull();
    expect(isExpiredAuthHashError(hashError!)).toBe(true);
  });

  it("treats a non-expired hash error as not expired", () => {
    window.location.hash = "#error=access_denied&error_code=otp_invalid&error_description=bad";
    const hashError = getAuthHashError();
    expect(hashError).not.toBeNull();
    expect(isExpiredAuthHashError(hashError!)).toBe(false);
  });
});
