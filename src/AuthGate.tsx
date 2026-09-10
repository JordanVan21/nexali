import { Navigate } from "react-router-dom";
import { useUser } from "./features/user/userUser";
import { UserIdProvider } from "./shared/userIdContext";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useUser();

  if (isLoading) return <div>Loading account…</div>;
  if (isError)   return <div>Failed to load user.</div>;
  if (!user?.id) return <Navigate to="/signin" replace />;

  return (
    <UserIdProvider value={{ userId: user.id, email: user.email ?? undefined }}>
      {children}
    </UserIdProvider>
  );
}