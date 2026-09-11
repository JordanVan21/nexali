import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { StatusBanner } from "../components/states/StatusBanner";
import { supabase } from "../supabaseClient";
import { resendVerificationEmail } from "../lib/auth";
import { normalizeAuthError, getAuthHashError, isExpiredAuthHashError } from "../lib/authErrors";
import { DEFAULT_AUTHENTICATED_ROUTE } from "../lib/routes";

const RESEND_COOLDOWN_SECONDS = 30;

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
        <StatusBanner variant="success">
          Your email address has been verified and you&apos;re signed in.
        </StatusBanner>
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

  if (view === "invalid") {
    return (
      <AuthLayout
        title="Verification link no longer valid"
        footer={
          <Link to="/signin" className="inline-flex items-center gap-1.5 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>
        }
      >
        <StatusBanner variant="error">{invalidMessage}</StatusBanner>
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
      title="Verify your email"
      subtitle={
        stateEmail
          ? `We've sent a confirmation link to ${stateEmail}. Click it to activate your account.`
          : "We've sent a confirmation link to your email. Click it to activate your account."
      }
      footer={
        <Link to="/signin" className="inline-flex items-center gap-1.5 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <MailCheck className="h-10 w-10 text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Didn&apos;t get the email? Check your spam folder, or request a new one below.
        </p>
      </div>

      <div className="mt-6">
        <ResendForm
          email={email}
          setEmail={setEmail}
          resendStatus={resendStatus}
          resendError={resendError}
          cooldown={cooldown}
          onResend={handleResend}
        />
      </div>
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
      <div>
        <Label htmlFor="resendEmail" className="text-card-foreground">
          Email
        </Label>
        <Input
          id="resendEmail"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2"
        />
      </div>

      {resendStatus === "sent" && cooldown > 0 && (
        <StatusBanner variant="success">Verification email sent. Check your inbox.</StatusBanner>
      )}
      {resendStatus === "error" && resendError && (
        <StatusBanner variant="error">{resendError}</StatusBanner>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full"
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
