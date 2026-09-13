import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserIdProvider } from "../shared/userIdContext";
import Assistant from "./Assistant";

vi.mock("../features/profiles/useProfile", () => ({
  useProfile: () => ({ data: undefined, isLoading: true, isError: false }),
}));

/**
 * Mirrors the two Aura-related lines in src/main.tsx exactly:
 *   <Route path="/assistant" element={<Assistant />} />
 *   <Route path="/aura" element={<Navigate to="/assistant" replace />} />
 * main.tsx itself calls ReactDOM.createRoot at module load and isn't
 * safely importable in a test, so this test recreates just those two
 * route entries to verify the real Assistant page renders at the
 * canonical path and that the alias redirects to it.
 */
function TestRoutes({ initialPath }: { initialPath: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <UserIdProvider value={{ userId: "test-user-id", email: "test@example.com" }}>
          <Routes>
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/aura" element={<Navigate to="/assistant" replace />} />
          </Routes>
        </UserIdProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Aura routing", () => {
  it("renders the real Assistant page at the canonical /assistant path", () => {
    render(<TestRoutes initialPath="/assistant" />);
    expect(screen.getByRole("heading", { name: "Aura", level: 1 })).toBeInTheDocument();
  });

  it("redirects /aura to /assistant, rendering the same real page", () => {
    render(<TestRoutes initialPath="/aura" />);
    expect(screen.getByRole("heading", { name: "Aura", level: 1 })).toBeInTheDocument();
  });
});
