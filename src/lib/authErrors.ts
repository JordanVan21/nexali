const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/**
 * Converts a raw Supabase Auth error (or any thrown value) into a short,
 * user-safe message. Never forwards database internals, stack traces,
 * tokens, or provider-specific text to the UI. The original error is still
 * logged for development diagnostics.
 *
 * Deliberately does not reveal whether a given email address has an
 * account: sign-in and sign-up failures map to the same kind of generic
 * wording an attacker could not use to enumerate accounts.
 */
export function normalizeAuthError(error: unknown, fallback: string = FALLBACK_MESSAGE): string {
  if (!error) return fallback;

  if (import.meta.env.DEV) {
    console.error("Auth error:", error);
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your connection and try again.";
  }
  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please verify your email address before signing in.";
  }
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (lower.includes("password") && (lower.includes("least") || lower.includes("character") || lower.includes("short"))) {
    // Supabase's own password-policy message is already short and user-safe.
    return message;
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch failed") || lower.includes("failed to fetch")) {
    return "Network error. Check your connection and try again.";
  }
  if (lower.includes("valid email") || (lower.includes("email") && lower.includes("invalid"))) {
    return "Enter a valid email address.";
  }
  if (lower.includes("expired")) {
    return "This link has expired. Please request a new one.";
  }
  if (lower.includes("session") || lower.includes("token") || lower.includes("otp")) {
    return "This link is invalid or has expired.";
  }
  if (lower.includes("required")) {
    return "Please fill in all required fields.";
  }

  return fallback;
}

/**
 * Reads a Supabase auth error surfaced as URL hash params (for example
 * #error=access_denied&error_code=otp_expired&error_description=...), which
 * is how the implicit flow reports an invalid or expired recovery/
 * verification link instead of firing onAuthStateChange. The specific
 * reason (expired vs. otherwise invalid) lives in error_code, not error,
 * which is usually just the generic "access_denied".
 */
export function getAuthHashError(): { error: string; code: string; description: string } | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const error = params.get("error");
  const code = params.get("error_code");
  if (!error && !code) return null;

  return { error: error ?? "", code: code ?? "", description: params.get("error_description") ?? "" };
}

/** True when a parsed auth hash error indicates an expired (vs. otherwise invalid) link. */
export function isExpiredAuthHashError(hashError: { code: string; description: string }): boolean {
  return hashError.code.includes("expired") || hashError.description.toLowerCase().includes("expired");
}
