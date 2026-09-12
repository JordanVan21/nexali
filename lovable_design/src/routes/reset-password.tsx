import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordField, getPasswordStrength } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const title = "Reset Password — Nexali";
const description = "Choose a new password to secure your Nexali account.";

export const Route = createFileRoute("/reset-password")({
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
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [success, setSuccess] = useState(false);

  const requirements = useMemo(
    () => [
      { key: "length", label: "8+ characters", met: password.length >= 8 },
      { key: "upper", label: "Uppercase letter", met: /[A-Z]/.test(password) },
      { key: "number", label: "At least 1 number", met: /\d/.test(password) },
      { key: "special", label: "Special character", met: /[^A-Za-z0-9]/.test(password) },
    ],
    [password],
  );

  const strength = getPasswordStrength(password);
  const matches = confirm.length > 0 && confirm === password;
  const showMismatch = confirm.length > 0 && !matches;
  const allRequirementsMet = requirements.every((r) => r.met);
  const canSubmit = allRequirementsMet && matches;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!canSubmit) return;
    setSuccess(true);
  };

  if (success) {
    return (
      <AuthLayout
        title="Password Updated"
        description="Your password has been changed successfully."
        footer={
          <Link
            to="/signin"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Continue to sign in
          </Link>
        }
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-success/20 bg-success/10 text-success">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-foreground">
            You can now sign in to Nexali with your new password.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create New Password"
      description="Choose a strong password to secure your Nexali account."
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
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          placeholder="Enter new password"
          autoComplete="new-password"
          showStrength
        />

        <div className="space-y-2.5 rounded-lg bg-surface p-3.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Password requirements
          </span>
          <div className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
            {requirements.map((req) => (
              <div
                key={req.key}
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  req.met ? "text-success" : "text-muted-foreground",
                )}
              >
                <Check className={cn("h-3.5 w-3.5", !req.met && "opacity-40")} aria-hidden="true" />
                {req.label}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Confirm new password"
            autoComplete="new-password"
            error={showMismatch || (submitted && !matches) ? "Passwords do not match" : undefined}
          />
        </div>

        <Button type="submit" variant="brand" size="control" className="w-full">
          Reset Password
        </Button>
      </form>
    </AuthLayout>
  );
}
