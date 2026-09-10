import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthError } from "@supabase/supabase-js";
import { AuthGate } from "./AuthGate";

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { supabase } from "./supabaseClient";

type GetUserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;

function renderAuthGate() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/signin" element={<div>Sign in page</div>} />
          <Route
            path="/dashboard"
            element={
              <AuthGate>
                <div>Protected content</div>
              </AuthGate>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AuthGate", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the session is being checked", () => {
    vi.mocked(supabase.auth.getUser).mockImplementation(
      () => new Promise<GetUserResult>(() => {})
    );

    renderAuthGate();

    expect(screen.getByText(/loading account/i)).toBeInTheDocument();
  });

  it("redirects to /signin when there is no authenticated user", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: new AuthError("Auth session missing!"),
    } as GetUserResult);

    renderAuthGate();

    await waitFor(() => {
      expect(screen.getByText(/sign in page/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/protected content/i)).not.toBeInTheDocument();
  });

  it("renders the protected content once a user is loaded", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: "user-1", email: "jane@example.com" },
      },
      error: null,
    } as unknown as GetUserResult);

    renderAuthGate();

    await waitFor(() => {
      expect(screen.getByText(/protected content/i)).toBeInTheDocument();
    });
  });
});
