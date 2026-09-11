import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
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
      subtitle="Enter your email address and we'll send you instructions to reset your password."
      icon={KeyRound}
      footer={
        <Link to="/signin" className="inline-flex items-center gap-1.5 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      {status === "sent" ? (
        <StatusBanner variant="success">
          If an account exists for that email, we&apos;ve sent password reset instructions. Check
          your inbox.
        </StatusBanner>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <TextField
            id="email"
            label="Email"
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

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={status === "pending"}>
            {status === "pending" ? "Sending…" : "Send Reset Link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
