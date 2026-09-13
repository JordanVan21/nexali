import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthError } from "@supabase/supabase-js";
import SignUp from "./SignUp";

vi.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

import { supabase } from "../supabaseClient";

type GetUserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;
type SignUpResult = Awaited<ReturnType<typeof supabase.auth.signUp>>;

function mockUnauthenticated() {
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: null },
    error: null,
  } as unknown as GetUserResult);
}

function renderSignUp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
          <Route path="/verify-email" element={<div>Verify email page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/full name/i), "Jane Doe");
  await user.type(screen.getByLabelText(/^email address$/i), "jane@example.com");
  await user.type(screen.getByLabelText(/^password$/i), "hunter22");
  await user.type(screen.getByLabelText(/confirm password/i), "hunter22");
}

describe("SignUp", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a password shorter than the minimum length before calling Supabase", async () => {
    mockUnauthenticated();
    const user = userEvent.setup();
    renderSignUp();

    await user.type(await screen.findByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/^email address$/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "abc");
    await user.type(screen.getByLabelText(/confirm password/i), "abc");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("rejects a mismatched password confirmation before calling Supabase", async () => {
    mockUnauthenticated();
    const user = userEvent.setup();
    renderSignUp();

    await user.type(await screen.findByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/^email address$/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "hunter22");
    await user.type(screen.getByLabelText(/confirm password/i), "different1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect((await screen.findAllByText(/passwords do not match/i)).length).toBeGreaterThan(0);
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("submits the account details and moves to the verify-email step on success", async () => {
    mockUnauthenticated();
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    } as unknown as SignUpResult);

    const user = userEvent.setup();
    renderSignUp();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "jane@example.com",
          password: "hunter22",
          options: expect.objectContaining({ data: { full_name: "Jane Doe" } }),
        })
      );
    });
    expect(await screen.findByText("Verify email page")).toBeInTheDocument();
  });

  it("does not manually insert a profile row; it only forwards full_name as auth metadata", async () => {
    mockUnauthenticated();
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    } as unknown as SignUpResult);

    const user = userEvent.setup();
    renderSignUp();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalledTimes(1));
    const call = vi.mocked(supabase.auth.signUp).mock.calls[0][0];
    expect(Object.keys(call)).toEqual(["email", "password", "options"]);
  });

  it("shows a user-facing error when Supabase rejects the sign-up", async () => {
    mockUnauthenticated();
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthError("User already registered"),
    } as unknown as SignUpResult);

    const user = userEvent.setup();
    renderSignUp();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/account with that email already exists/i)).toBeInTheDocument();
  });

  it("disables the submit button while the request is pending", async () => {
    mockUnauthenticated();
    vi.mocked(supabase.auth.signUp).mockReturnValue(new Promise<SignUpResult>(() => {}));

    const user = userEvent.setup();
    renderSignUp();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("button", { name: /creating account/i })).toBeDisabled();
  });

  it("sends an already-authenticated user straight to the dashboard instead of showing the form", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "u1", email: "jane@example.com" } },
      error: null,
    } as unknown as GetUserResult);

    renderSignUp();

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("shows only the real password requirement, no fake Terms/Privacy checkbox or unsupported auth options", async () => {
    mockUnauthenticated();
    renderSignUp();

    expect(await screen.findByText("At least 6 characters")).toBeInTheDocument();
    expect(screen.queryByText(/at least 8 characters/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/terms of service/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/google|apple|github/i)).not.toBeInTheDocument();
  });

  it("shows an advisory password-strength meter driven by the real entered password, without blocking a 6-character password", async () => {
    mockUnauthenticated();
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { id: "u1" }, session: null },
      error: null,
    } as unknown as SignUpResult);

    const user = userEvent.setup();
    renderSignUp();

    expect(await screen.findByText(/strength: empty/i)).toBeInTheDocument();

    const passwordField = screen.getByLabelText(/^password$/i);
    await user.type(passwordField, "weak");
    expect(await screen.findByText(/strength: weak/i)).toBeInTheDocument();

    await user.clear(passwordField);
    await user.type(passwordField, "Str0ng!Pass");
    expect(await screen.findByText(/strength: strong/i)).toBeInTheDocument();

    // A real 6-character password must still be accepted -- the strength
    // meter is advisory only and never raises the real minimum.
    await user.clear(passwordField);
    await user.type(passwordField, "hunter22");
    await user.type(screen.getByLabelText(/confirm password/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalledTimes(1));
  });
});
