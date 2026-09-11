import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "./features/user/userUser";
import { UserIdProvider } from "./shared/userIdContext";
import { PageLoading } from "./components/states/Skeleton";
import { ErrorState } from "./components/states/ErrorState";
import { PUBLIC_ROUTES, REDIRECT_PARAM } from "./lib/routes";

/**
 * Gates every authenticated route. While the session is resolving it shows
 * a loading state rather than any protected content, so there is never a
 * flash of the wrong UI. When no user is found, it sends the visitor to
 * Sign In while preserving the route they actually asked for (as an
 * internal-only ?redirect= path built from this app's own location, never
 * from external input) so a successful sign-in can return them there.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError, refetch } = useUser();
  const location = useLocation();

  if (isLoading) {
    return <PageLoading label="Loading account" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="We couldn't load your account"
        message="Please check your connection and try again."
        onRetry={() => refetch()}
      />
    );
  }

  if (!user?.id) {
    const intendedPath = `${location.pathname}${location.search}`;
    const params = new URLSearchParams();
    if (intendedPath && intendedPath !== PUBLIC_ROUTES.landing) {
      params.set(REDIRECT_PARAM, intendedPath);
    }
    const query = params.toString();
    return <Navigate to={`${PUBLIC_ROUTES.signIn}${query ? `?${query}` : ""}`} replace />;
  }

  return (
    <UserIdProvider value={{ userId: user.id, email: user.email ?? undefined }}>
      {children}
    </UserIdProvider>
  );
}
