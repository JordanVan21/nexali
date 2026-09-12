import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const title = "Forgot Password — Nexali";
const description = "Request a password reset link for your Nexali account.";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSent(true);
  };

  const handleResend = () => {
    setResent(true);
    window.setTimeout(() => setResent(false), 2500);
  };

  return (
    <AuthLayout
      title="Reset Your Password"
      description="Enter your verified email address and we will send you secure password reset instructions."
      footer={
        <Link
          to="/signin"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-success/20 bg-success/10 text-success">
            <MailCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-lg font-semibold text-foreground">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent reset instructions to <span className="text-foreground">{email}</span>. The
              link expires in 15 minutes.
            </p>
          </div>
          <Button variant="surface" size="control" className="w-full" onClick={handleResend}>
            {resent ? "Email resent" : "Resend email"}
          </Button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm text-muted-foreground">
              Email address
            </Label>
            <div className="relative flex items-center">
              <Mail className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. alex@nexali.app"
                autoComplete="email"
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "email-error" : undefined}
                className="h-12 rounded-lg border-outline-variant bg-surface-lowest pl-10 text-base"
              />
            </div>
            {error ? (
              <p id="email-error" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <Button type="submit" variant="brand" size="control" className="w-full">
            Send Reset Link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
