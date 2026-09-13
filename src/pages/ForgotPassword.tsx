import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { TextField } from "../components/auth/TextField";
import { Button } from "../components/ui/button";
import { StatusBanner } from "../components/states/StatusBanner";
import { requestPasswordReset } from "../lib/auth";
import { normalizeAuthError } from "../lib/authErrors";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "pending") return;

    setStatus("pending");
    setErrorMessage(null);
    try {
      await requestPasswordReset(email);
      setStatus("sent");
    } catch (err) {
      setErrorMessage(normalizeAuthError(err, "We couldn't send that email right now."));
      setStatus("error");
    }
  };

  return (
    <AuthLayout
      title="Reset Your Password"
      subtitle="Enter the email address for your account and we'll send you secure password reset instructions."
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
      {status === "sent" ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-success/20 bg-success/10 text-success">
            <MailCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold text-foreground">Check your inbox</h2>
            <StatusBanner variant="success">
              If an account exists for that email, we&apos;ve sent password reset instructions. Check
              your inbox.
            </StatusBanner>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <TextField
            id="email"
            label="Email address"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {status === "error" && errorMessage && (
            <StatusBanner variant="error">{errorMessage}</StatusBanner>
          )}

          <Button
            type="submit"
            variant="hero"
            size="control"
            className="h-14 w-full text-base font-semibold sm:text-lg"
            disabled={status === "pending"}
          >
            {status === "pending" ? "Sending…" : "Send Reset Link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
