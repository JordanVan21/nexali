import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Check, Mail, User } from "lucide-react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordField, getPasswordStrength } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const title = "Create Account — Nexali";
const description = "Create your Nexali account to start tracking spend and chatting with Aura.";

export const Route = createFileRoute("/signup")({
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
  component: SignupPage,
});

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  terms?: string;
}

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const strength = getPasswordStrength(password);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: FormErrors = {};

    if (!name.trim()) nextErrors.name = "Enter your full name.";
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "Enter a valid email address.";
    if (password.length < 8) nextErrors.password = "Use at least 8 characters.";
    if (confirm !== password || !confirm) nextErrors.confirm = "Passwords do not match.";
    if (!agreed) nextErrors.terms = "You must accept the Terms to continue.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      navigate({ to: "/email-verification" });
    }, 600);
  };

  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains a symbol (@#$%^&*)", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  return (
    <AuthLayout
      title="Create Account"
      description="Join Nexali to manage budgets, transactions, and your Aura assistant."
      maxWidthClassName="max-w-[480px]"
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/signin" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm text-muted-foreground">
            Full name
          </Label>
          <div className="relative flex items-center">
            <User className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jordan Lee"
              autoComplete="name"
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
              className="h-12 rounded-lg border-outline-variant bg-surface-lowest pl-10 text-base"
            />
          </div>
          {errors.name ? (
            <p id="name-error" className="text-xs text-destructive">
              {errors.name}
            </p>
          ) : null}
        </div>

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

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          showStrength
          error={errors.password}
        />

        <div className="space-y-1.5 rounded-lg bg-surface p-3.5">
          {requirements.map((req) => (
            <div
              key={req.label}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors",
                req.met ? "text-success" : "text-muted-foreground",
              )}
            >
              <Check className={cn("h-3.5 w-3.5", !req.met && "opacity-40")} aria-hidden="true" />
              {req.label}
            </div>
          ))}
        </div>

        <PasswordField
          id="confirm-password"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={errors.confirm}
        />

        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-2">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(Boolean(v))}
              aria-invalid={Boolean(errors.terms)}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground">
              I agree to the Terms of Service and Privacy Policy.
            </span>
          </label>
          {errors.terms ? <p className="mt-1 text-xs text-destructive">{errors.terms}</p> : null}
        </div>

        <Button
          type="submit"
          variant="brand"
          size="control"
          className="w-full"
          disabled={submitting || strength.score === 0}
        >
          {submitting ? "Creating account…" : "Create Account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
