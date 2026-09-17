import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { TextField } from "../components/auth/TextField";
import { Button } from "../components/ui/button";
import { StatusBanner } from "../components/states/StatusBanner";
import { supabase } from "../supabaseClient";
import { resendVerificationEmail } from "../lib/auth";
import { normalizeAuthError, getAuthHashError, isExpiredAuthHashError } from "../lib/authErrors";
import { DEFAULT_AUTHENTICATED_ROUTE } from "../lib/routes";

/**
 * Must be >= the linked Supabase project's real `auth.email.max_frequency`
 * (confirmed via `npx supabase config diff` on 2026-09-16 to be 60s on the
 * remote project -- NOT the 1s local-dev default in supabase/config.toml).
 * The prior value of 30 let the button unlock and invite a second resend
 * before Supabase's own server-side throttle would actually allow another
 * send, which is a real, confirmed UX bug independent of the account-state
 * root cause investigated the same day (see docs/BACKEND_AUDIT_REPORT.md's
 * auth-email-verification entry).
 */
const RESEND_COOLDOWN_SECONDS = 60;

type ViewState = "waiting" | "success" | "invalid";

/**
 * Handles the signup confirmation link. Nexali's confirmation email uses
 * Supabase's default link flow (not a manual OTP code), so this page's job
 * is to show a waiting state with a resend option while the user checks
 * their inbox, and to react to the session Supabase's implicit-flow client
 * creates automatically once that link is opened here.
 */
export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateEmail = (location.state as { email?: string } | null)?.email;

  const [view, setView] = useState<ViewState>("waiting");
  const [invalidMessage, setInvalidMessage] = useState(
    "This verification link is invalid or has expired."
  );
  const [email, setEmail] = useState(stateEmail ?? "");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const hashError = getAuthHashError();
    if (hashError) {
      setInvalidMessage(
        isExpiredAuthHashError(hashError)
          ? "This verification link has expired. Request a new one below."
          : "This verification link is invalid. Request a new one below."
      );
      setView("invalid");
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setView("success");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setView("success");
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleResend = async () => {
    if (resendStatus === "sending" || cooldown > 0 || !email) return;

    setResendStatus("sending");
    setResendError(null);
    try {
      await resendVerificationEmail(email);
      setResendStatus("sent");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setResendError(normalizeAuthError(err, "We couldn't resend that email right now."));
      setResendStatus("error");
    }
  };

  if (view === "success") {
    return (
      <AuthLayout title="Email verified">
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-success/20 bg-success/10 text-success">
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <StatusBanner variant="success">
            Your email address has been verified and you&apos;re signed in.
          </StatusBanner>
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

  if (view === "invalid") {
    return (
      <AuthLayout
        title="Verification link no longer valid"
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
        <div className="mb-7 space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
          </div>
          <StatusBanner variant="error">{invalidMessage}</StatusBanner>
        </div>
        <ResendForm
          email={email}
          setEmail={setEmail}
          resendStatus={resendStatus}
          resendError={resendError}
          cooldown={cooldown}
          onResend={handleResend}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify Your Email Address"
      subtitle={
        stateEmail
          ? `We've sent a confirmation link to ${stateEmail}. Click it to activate your account.`
          : "We've sent a confirmation link to your email. Click it to activate your account."
      }
      footer={
        <Link
          to="/signin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      <div className="mb-7 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Mail className="h-8 w-8" aria-hidden="true" />
        </div>
      </div>

      <p className="mb-7 text-center text-[15px] text-muted-foreground sm:text-base">
        Didn&apos;t get the email? Check your spam folder, or request a new one below.
      </p>

      <ResendForm
        email={email}
        setEmail={setEmail}
        resendStatus={resendStatus}
        resendError={resendError}
        cooldown={cooldown}
        onResend={handleResend}
      />
    </AuthLayout>
  );
}

type ResendFormProps = {
  email: string;
  setEmail: (value: string) => void;
  resendStatus: "idle" | "sending" | "sent" | "error";
  resendError: string | null;
  cooldown: number;
  onResend: () => void;
};

function ResendForm({ email, setEmail, resendStatus, resendError, cooldown, onResend }: ResendFormProps) {
  return (
    <div className="space-y-3">
      <TextField
        id="resendEmail"
        label="Email address"
        icon={Mail}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {resendStatus === "sent" && cooldown > 0 && (
        <StatusBanner variant="success">Verification email sent. Check your inbox.</StatusBanner>
      )}
      {resendStatus === "error" && resendError && (
        <StatusBanner variant="error">{resendError}</StatusBanner>
      )}

      <Button
        type="button"
        variant="surface"
        size="control"
        className="h-14 w-full text-base font-semibold sm:text-lg"
        onClick={onResend}
        disabled={resendStatus === "sending" || cooldown > 0 || !email}
      >
        {resendStatus === "sending"
          ? "Sending…"
          : cooldown > 0
          ? `Resend available in ${cooldown}s`
          : "Resend verification email"}
      </Button>
    </div>
  );
}
