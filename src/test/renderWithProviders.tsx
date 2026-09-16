import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserIdProvider } from "../shared/userIdContext";

type Options = {
  route?: string;
};

/**
 * Shared render helper for components that need a router location, a
 * query client, and an authenticated user context. Used by the shell
 * component tests, which all depend on at least useLocation and
 * useUserInfo.
 */
export function renderWithProviders(ui: ReactNode, { route = "/dashboard" }: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <UserIdProvider value={{ userId: "test-user-id", email: "test@example.com" }}>{ui}</UserIdProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
