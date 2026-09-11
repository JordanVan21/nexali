import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthError } from "@supabase/supabase-js";
import SignIn from "./SignIn";

vi.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  },
}));

import { supabase } from "../supabaseClient";

type GetUserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;
type SignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

function mockUnauthenticated() {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: null },
    error: null,
  } as unknown as GetUserResult);
}

function renderSignIn(initialEntry = "/signin") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
          <Route path="/transactions" element={<div>Transactions page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SignIn", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("submits the entered email and password", async () => {
    mockUnauthenticated();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    } as unknown as SignInResult);

    const user = userEvent.setup();
    renderSignIn();

    await user.type(await screen.findByLabelText(/^email$/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "hunter22",
      });
    });
  });

  it("redirects to the dashboard by default after a successful sign-in", async () => {
    mockUnauthenticated();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    } as unknown as SignInResult);

    const user = userEvent.setup();
    renderSignIn();

    await user.type(await screen.findByLabelText(/^email$/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("returns to the originally requested internal route after a successful sign-in", async () => {
    mockUnauthenticated();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    } as unknown as SignInResult);

    const user = userEvent.setup();
    renderSignIn("/signin?redirect=%2Ftransactions");

    await user.type(await screen.findByLabelText(/^email$/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Transactions page")).toBeInTheDocument();
  });

  it("rejects an external redirect target and falls back to the dashboard", async () => {
    mockUnauthenticated();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    } as unknown as SignInResult);

    const user = userEvent.setup();
    renderSignIn("/signin?redirect=https%3A%2F%2Fmalicious-site.example");

    await user.type(await screen.findByLabelText(/^email$/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("shows a user-facing error on invalid credentials without exposing raw details", async () => {
    mockUnauthenticated();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthError("Invalid login credentials"),
    } as unknown as SignInResult);

    const user = userEvent.setup();
    renderSignIn();

    await user.type(await screen.findByLabelText(/^email$/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument();
    expect(screen.queryByText(/invalid login credentials/i)).not.toBeInTheDocument();
  });

  it("disables the submit button and shows a loading label while the request is pending", async () => {
    mockUnauthenticated();
    let resolveSignIn!: (value: SignInResult) => void;
    vi.mocked(supabase.auth.signInWithPassword).mockReturnValue(
      new Promise<SignInResult>((resolve) => {
        resolveSignIn = resolve;
      })
    );

    const user = userEvent.setup();
    renderSignIn();

    await user.type(await screen.findByLabelText(/^email$/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const pendingButton = await screen.findByRole("button", { name: /signing in/i });
    expect(pendingButton).toBeDisabled();

    resolveSignIn({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    } as unknown as SignInResult);
  });

  it("toggles password visibility without altering the entered value", async () => {
    mockUnauthenticated();
    const user = userEvent.setup();
    renderSignIn();

    const passwordInput = await screen.findByLabelText(/^password$/i);
    await user.type(passwordInput, "hunter22");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(passwordInput).toHaveValue("hunter22");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveValue("hunter22");
  });

  it("sends an already-authenticated user straight to the dashboard instead of showing the form", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "u1", email: "jane@example.com" } },
      error: null,
    } as unknown as GetUserResult);

    renderSignIn();

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });
});
