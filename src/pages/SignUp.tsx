import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSignUp } from "../features/user/useSignIn";
import { useRedirectIfAuthenticated } from "../features/user/useRedirectIfAuthenticated";
import { AuthLayout } from "../components/auth/AuthLayout";
import { PasswordField } from "../components/auth/PasswordField";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { StatusBanner } from "../components/states/StatusBanner";
import { normalizeAuthError } from "../lib/authErrors";
import { DEFAULT_AUTHENTICATED_ROUTE } from "../lib/routes";

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (signUp.isPending) return;

    setErrorMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
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
      title="Create your account"
      subtitle="Start tracking your finances with Nexali"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="fullName" className="text-card-foreground">
            Full name
          </Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Jordan Van"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="email" className="text-card-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-2"
          />
        </div>

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
        />

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

        {errorMessage && <StatusBanner variant="error">{errorMessage}</StatusBanner>}

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={signUp.isPending}>
          {signUp.isPending ? "Creating account…" : "Create Account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
