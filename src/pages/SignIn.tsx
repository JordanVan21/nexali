import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSignIn } from "../features/user/useSignIn";
import { useRedirectIfAuthenticated } from "../features/user/useRedirectIfAuthenticated";
import { AuthLayout } from "../components/auth/AuthLayout";
import { PasswordField } from "../components/auth/PasswordField";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { StatusBanner } from "../components/states/StatusBanner";
import { normalizeAuthError } from "../lib/authErrors";
import { getSafeRedirectPath, REDIRECT_PARAM } from "../lib/routes";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const signIn = useSignIn();

  const redirectTarget = getSafeRedirectPath(searchParams.get(REDIRECT_PARAM));
  const { checking, authenticated } = useRedirectIfAuthenticated(redirectTarget);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (signIn.isPending) return;

    setErrorMessage(null);
    signIn.mutate(
      { email, password },
      {
        onSuccess: () => navigate(redirectTarget, { replace: true }),
        onError: (err) => setErrorMessage(normalizeAuthError(err, "We couldn't sign you in.")),
      }
    );
  };

  if (checking || authenticated) return null;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Nexali account"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
          labelExtra={
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          }
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Enter your password"
          required
        />

        {errorMessage && <StatusBanner variant="error">{errorMessage}</StatusBanner>}

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={signIn.isPending}>
          {signIn.isPending ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </AuthLayout>
  );
}
