import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { AlertCircle, Mail } from "lucide-react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const title = "Sign In — Nexali";
const description = "Sign in to your Nexali account to manage budgets, transactions, and your Aura assistant.";

export const Route = createFileRoute("/signin")({
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
  component: SigninPage,
});

// Mock credential for demoing the error state in this design prototype.
const MOCK_VALID_EMAIL = "demo@nexali.app";
const MOCK_VALID_PASSWORD = "password123";

function SigninPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      if (email === MOCK_VALID_EMAIL && password === MOCK_VALID_PASSWORD) {
        navigate({ to: "/dashboard" });
      } else {
        setFormError("Incorrect email or password. Try demo@nexali.app / password123.");
      }
    }, 600);
  };

  return (
    <AuthLayout
      title="Nexali"
      description="Secure sign in to your money command center"
      footer={
        <p className="text-sm text-muted-foreground">
          New to Nexali?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sign in failed</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

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
              placeholder="name@company.com"
              autoComplete="email"
              required
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className="h-12 rounded-lg border-outline-variant bg-surface-lowest pl-10 text-base"
            />
          </div>
          {errors.email ? (
            <p id="email-error" className="text-xs text-destructive">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="text-sm text-muted-foreground">
              Password
            </Label>
            <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            label=""
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            error={errors.password}
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-2">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
          <span className="text-sm text-muted-foreground">Keep me signed in</span>
        </label>

        <Button type="submit" variant="brand" size="control" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </AuthLayout>
  );
}
