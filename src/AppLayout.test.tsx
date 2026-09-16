import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserIdProvider } from "./shared/userIdContext";
import AppLayout from "./AppLayout";
import Friends from "./pages/Friends";

vi.mock("./features/profiles/useAvatar", () => ({
  useAvatar: () => ({ data: null }),
}));
vi.mock("./features/user/useSignOut", () => ({
  useSignOut: () => vi.fn(),
}));

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <UserIdProvider value={{ userId: "test-user-id", email: "test@example.com" }}>
          <Routes>
            <Route path="/public" element={<div>Public page</div>} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<div>Dashboard content</div>} />
              <Route path="/friends" element={<Friends />} />
            </Route>
          </Routes>
        </UserIdProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AppLayout", () => {
  it("renders the authenticated navigation around a protected route", () => {
    renderApp("/dashboard");

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Bottom" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });

  it("does not render authenticated navigation on a public route", () => {
    renderApp("/public");

    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Bottom" })).not.toBeInTheDocument();
    expect(screen.getByText("Public page")).toBeInTheDocument();
  });

  describe("Friends badge shares live state with the Friends page (FriendsProvider, mounted once)", () => {
    it("accepting an incoming request on the Friends page immediately decreases the nav badge", async () => {
      const user = userEvent.setup();
      renderApp("/friends");

      const primaryNav = screen.getByRole("navigation", { name: "Primary" });
      expect(within(primaryNav).getByRole("link", { name: "Friends, 1 pending request" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Accept friend request from Marcus Chen" }));

      expect(await within(primaryNav).findByRole("link", { name: "Friends" })).toBeInTheDocument();
      expect(within(primaryNav).queryByRole("link", { name: /pending request/i })).not.toBeInTheDocument();
    });

    it("declining an incoming request on the Friends page immediately decreases the nav badge", async () => {
      const user = userEvent.setup();
      renderApp("/friends");

      const primaryNav = screen.getByRole("navigation", { name: "Primary" });
      expect(within(primaryNav).getByRole("link", { name: "Friends, 1 pending request" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Decline friend request from Marcus Chen" }));

      expect(await within(primaryNav).findByRole("link", { name: "Friends" })).toBeInTheDocument();
    });
  });
});
