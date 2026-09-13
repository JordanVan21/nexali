import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { PasswordField } from "../components/auth/PasswordField";
import { Button } from "../components/ui/button";
import { StatusBanner } from "../components/states/StatusBanner";
import { PageLoading } from "../components/states/Skeleton";
import { supabase } from "../supabaseClient";
import { updatePassword } from "../lib/auth";
import { normalizeAuthError, getAuthHashError, isExpiredAuthHashError } from "../lib/authErrors";
import { DEFAULT_AUTHENTICATED_ROUTE } from "../lib/routes";
import { cn } from "../lib/utils";

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

  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setErrorMessage(null);

    if (!passwordLongEnough) {
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
      <AuthLayout title="Checking your reset link">
        <PageLoading label="Checking your reset link" />
      </AuthLayout>
    );
  }

  if (view === "invalid") {
    return (
      <AuthLayout
        title="Reset link no longer valid"
        footer={
          <Link
            to="/signin"
            className="inline-flex items-center gap-1.5 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-base"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>
        }
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
          </div>
          <StatusBanner variant="error">{invalidMessage}</StatusBanner>
          <Link
            to="/forgot-password"
            className="inline-block text-[15px] font-semibold text-primary hover:underline sm:text-base"
          >
            Request a new reset link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (view === "success") {
    return (
      <AuthLayout title="Password Updated" subtitle="Your password has been updated.">
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-success/20 bg-success/10 text-success">
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <Button
            variant="hero"
            size="control"
            className="h-14 w-full text-base font-semibold sm:text-lg"
            onClick={() => navigate(DEFAULT_AUTHENTICATED_ROUTE, { replace: true })}
          >
            Continue to Dashboard
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create New Password" subtitle="Choose a strong password to secure your Nexali account.">
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {errorMessage && <StatusBanner variant="error">{errorMessage}</StatusBanner>}

        <PasswordField
          id="password"
          label="New password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setMismatch(false);
          }}
          autoComplete="new-password"
          placeholder="Enter new password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          showStrength
        />

        <div className="space-y-2.5 rounded-lg bg-surface p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Password requirements
          </span>
          <div
            className={cn(
              "flex items-center gap-2 text-sm transition-colors",
              passwordLongEnough ? "text-success" : "text-muted-foreground"
            )}
          >
            <Check className={cn("h-4 w-4 shrink-0", !passwordLongEnough && "opacity-40")} aria-hidden="true" />
            At least {MIN_PASSWORD_LENGTH} characters
          </div>
        </div>

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

        <Button
          type="submit"
          variant="hero"
          size="control"
          className="h-14 w-full text-base font-semibold sm:text-lg"
          disabled={submitting}
        >
          {submitting ? "Updating…" : "Reset Password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
