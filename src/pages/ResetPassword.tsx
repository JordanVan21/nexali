import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { PasswordField } from "../components/auth/PasswordField";
import { Button } from "../components/ui/button";
import { StatusBanner } from "../components/states/StatusBanner";
import { PageLoading } from "../components/states/Skeleton";
import { supabase } from "../supabaseClient";
import { updatePassword } from "../lib/auth";
import { normalizeAuthError, getAuthHashError, isExpiredAuthHashError } from "../lib/authErrors";
import { DEFAULT_AUTHENTICATED_ROUTE } from "../lib/routes";

const MIN_PASSWORD_LENGTH = 6;

type ViewState = "checking" | "ready" | "invalid" | "success";

/**
 * Reads the recovery session left by Supabase's implicit-flow client after
 * a password-reset link is opened. detectSessionInUrl already turns the
 * link's hash tokens into a session with no code on our side, so this page
 * only has to react to that outcome via onAuthStateChange (PASSWORD_
 * RECOVERY) plus an immediate getSession() check, and treat an expired or
 * tampered link (reported as #error=... in the hash) or the absence of any
 * session as "invalid", never as if the form were valid.
 */
export default function ResetPassword() {
  const [view, setView] = useState<ViewState>("checking");
  const [invalidMessage, setInvalidMessage] = useState(
    "This password reset link is invalid or has expired."
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const hashError = getAuthHashError();
    if (hashError) {
      setInvalidMessage(
        isExpiredAuthHashError(hashError)
          ? "This password reset link has expired. Request a new one."
          : "This password reset link is invalid. Request a new one."
      );
      setView("invalid");
      return;
    }

    let settled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setView("ready");
      }
    });

    // The recovery event can fire before this effect subscribes (React
    // StrictMode's double-invoke, or a fast implicit-flow exchange), so also
    // check directly for an existing session on mount.
    supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      if (data.session) {
        settled = true;
        setView("ready");
        return;
      }
      // Give the hash exchange a brief moment to complete before concluding
      // there is no legitimate recovery session.
      setTimeout(() => {
        if (!settled) setView("invalid");
      }, 1200);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setErrorMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setMismatch(true);
      setErrorMessage("Passwords do not match.");
      return;
    }
    setMismatch(false);
    setSubmitting(true);
    try {
      await updatePassword(password);
      setView("success");
    } catch (err) {
      setErrorMessage(normalizeAuthError(err, "We couldn't update your password."));
    } finally {
      setSubmitting(false);
    }
  };

  if (view === "checking") {
    return (
      <AuthLayout title="Reset your password">
        <PageLoading label="Checking your reset link" />
      </AuthLayout>
    );
  }

  if (view === "invalid") {
    return (
      <AuthLayout
        title="Reset link no longer valid"
        footer={
          <Link to="/signin" className="inline-flex items-center gap-1.5 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>
        }
      >
        <StatusBanner variant="error">{invalidMessage}</StatusBanner>
        <div className="mt-4 text-center">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Request a new reset link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (view === "success") {
    return (
      <AuthLayout title="Password updated">
        <StatusBanner variant="success">Your password has been updated.</StatusBanner>
        <Button
          variant="hero"
          size="lg"
          className="mt-6 w-full"
          onClick={() => navigate(DEFAULT_AUTHENTICATED_ROUTE, { replace: true })}
        >
          Continue to Dashboard
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create a new password" subtitle="Choose a new password for your account.">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <PasswordField
          id="password"
          label="New password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setMismatch(false);
          }}
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          required
          minLength={MIN_PASSWORD_LENGTH}
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          value={confirmPassword}
          onChange={(v) => {
            setConfirmPassword(v);
            setMismatch(false);
          }}
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          required
          invalid={mismatch}
          errorMessage="Passwords do not match."
        />

        {errorMessage && <StatusBanner variant="error">{errorMessage}</StatusBanner>}

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Updating…" : "Reset Password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
