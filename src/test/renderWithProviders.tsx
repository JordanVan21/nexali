import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserIdProvider } from "../shared/userIdContext";
import { FriendsProvider } from "../features/friends/FriendsProvider";

type Options = {
  route?: string;
};

/**
 * Shared render helper for components that need a router location, a
 * query client, and an authenticated user context. Used by the shell
 * component tests, which all depend on at least useLocation and
 * useUserInfo.
 *
 * Also wraps FriendsProvider -- unlike FormatPreferencesProvider (whose
 * consumer hook falls back to safe display defaults when unmounted),
 * Friends' shared state is the real interaction surface (Friends.test.tsx
 * exercises real send/accept/decline/remove flows), so tests need the
 * genuine provider, not a no-op fallback. It's pure local React state with
 * no external dependency, so mounting it for every test here is harmless
 * even for suites that never touch Friends UI.
 */
export function renderWithProviders(ui: ReactNode, { route = "/dashboard" }: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <UserIdProvider value={{ userId: "test-user-id", email: "test@example.com" }}>
          <FriendsProvider>{ui}</FriendsProvider>
        </UserIdProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
