import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail } from "lucide-react";
import { useSignIn } from "../features/user/useSignIn";
import { useRedirectIfAuthenticated } from "../features/user/useRedirectIfAuthenticated";
import { AuthLayout } from "../components/auth/AuthLayout";
import { PasswordField } from "../components/auth/PasswordField";
import { TextField } from "../components/auth/TextField";
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
      title="Nexali"
      subtitle="Secure sign in to your money command center."
      footer={
        <>
          New to Nexali?{" "}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {errorMessage && <StatusBanner variant="error">{errorMessage}</StatusBanner>}

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
          labelExtra={
            <Link to="/forgot-password" className="text-[15px] font-medium text-primary hover:underline sm:text-base">
              Forgot password?
            </Link>
          }
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Enter your password"
          required
        />

        <Button
          type="submit"
          variant="hero"
          size="control"
          className="h-14 w-full text-base font-semibold sm:text-lg"
          disabled={signIn.isPending}
        >
          {signIn.isPending ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </AuthLayout>
  );
}
