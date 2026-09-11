import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "./userUser";

/**
 * Sends an already-authenticated user away from a public-only page (Sign
 * In, Sign Up) to their intended destination. Runs the navigation as an
 * effect, not during render, and reports "checking" while the session is
 * still resolving so callers can avoid flashing the auth form first.
 */
export function useRedirectIfAuthenticated(target: string) {
  const navigate = useNavigate();
  const { data: user, isLoading } = useUser();
  const authenticated = !isLoading && !!user?.id;

  useEffect(() => {
    if (authenticated) {
      navigate(target, { replace: true });
    }
  }, [authenticated, target, navigate]);

  return { checking: isLoading, authenticated };
}
