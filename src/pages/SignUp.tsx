import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Mail, User } from "lucide-react";
import { useSignUp } from "../features/user/useSignIn";
import { useRedirectIfAuthenticated } from "../features/user/useRedirectIfAuthenticated";
import { AuthLayout } from "../components/auth/AuthLayout";
import { PasswordField } from "../components/auth/PasswordField";
import { TextField } from "../components/auth/TextField";
import { Button } from "../components/ui/button";
import { StatusBanner } from "../components/states/StatusBanner";
import { normalizeAuthError } from "../lib/authErrors";
import { DEFAULT_AUTHENTICATED_ROUTE } from "../lib/routes";
import { cn } from "../lib/utils";

const MIN_PASSWORD_LENGTH = 6;

export default function SignUp() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);

  const navigate = useNavigate();
  const signUp = useSignUp();
  const { checking, authenticated } = useRedirectIfAuthenticated(DEFAULT_AUTHENTICATED_ROUTE);

  if (checking || authenticated) return null;

  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (signUp.isPending) return;

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

    signUp.mutate(
      { fullName, email, password },
      {
        onSuccess: () => {
          navigate("/verify-email", { state: { email }, replace: true });
        },
        onError: (err) => setErrorMessage(normalizeAuthError(err, "We couldn't create your account.")),
      }
    );
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Join Nexali to manage budgets, transactions, and your Aura assistant."
      maxWidthClassName="max-w-[580px]"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {errorMessage && <StatusBanner variant="error">{errorMessage}</StatusBanner>}

        <TextField
          id="fullName"
          label="Full name"
          icon={User}
          type="text"
          autoComplete="name"
          placeholder="Jordan Van"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

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

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setMismatch(false);
          }}
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
          label="Confirm password"
          value={confirmPassword}
          onChange={(v) => {
            setConfirmPassword(v);
            setMismatch(false);
          }}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          required
          invalid={mismatch}
          errorMessage="Passwords do not match."
        />

        <Button
          type="submit"
          variant="hero"
          size="control"
          className="h-14 w-full text-base font-semibold sm:text-lg"
          disabled={signUp.isPending}
        >
          {signUp.isPending ? "Creating account…" : "Create Account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
