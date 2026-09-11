import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthError } from "@supabase/supabase-js";
import VerifyEmail from "./VerifyEmail";

vi.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      resend: vi.fn(),
    },
  },
}));

import { supabase } from "../supabaseClient";

type AuthChangeCallback = Parameters<typeof supabase.auth.onAuthStateChange>[0];
type OnAuthStateChangeResult = ReturnType<typeof supabase.auth.onAuthStateChange>;
type GetSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
type ResendResult = Awaited<ReturnType<typeof supabase.auth.resend>>;

function mockAuthStateChange() {
  let callback: AuthChangeCallback = () => {};
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
    callback = cb;
    return {
      data: { subscription: { id: "sub", callback: cb, unsubscribe: vi.fn() } },
    } as unknown as OnAuthStateChangeResult;
  });
  return {
    fire: (event: string) => act(() => callback(event as never, null)),
  };
}

function renderVerifyEmail({ hash = "", email }: { hash?: string; email?: string } = {}) {
  window.location.hash = hash;
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/verify-email", state: email ? { email } : undefined }]}
    >
      <Routes>
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
        <Route path="/signin" element={<div>Sign in page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("VerifyEmail", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
  });

  it("shows a waiting state with the signed-up email when no session exists yet", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    mockAuthStateChange();

    renderVerifyEmail({ email: "jane@example.com" });

    expect(await screen.findByText(/jane@example.com/)).toBeInTheDocument();
  });

  it("shows a success state once Supabase reports a signed-in session", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    const { fire } = mockAuthStateChange();

    renderVerifyEmail({ email: "jane@example.com" });
    fire("SIGNED_IN");

    expect(await screen.findByRole("heading", { name: /email verified/i })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue to dashboard/i }));
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("shows an invalid-link message when Supabase reports an expired verification link", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    mockAuthStateChange();

    renderVerifyEmail({ hash: "#error=access_denied&error_code=otp_expired&error_description=x" });

    expect(await screen.findByText(/expired/i)).toBeInTheDocument();
  });

  it("resends the verification email and shows success feedback", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: null,
    } as unknown as ResendResult);
    mockAuthStateChange();

    const user = userEvent.setup();
    renderVerifyEmail({ email: "jane@example.com" });

    await user.click(await screen.findByRole("button", { name: /resend verification email/i }));

    expect(supabase.auth.resend).toHaveBeenCalledWith({ type: "signup", email: "jane@example.com" });
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();
  });

  it("disables further resends during the cooldown, preventing rapid repeated clicks", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: null,
    } as unknown as ResendResult);
    mockAuthStateChange();

    const user = userEvent.setup();
    renderVerifyEmail({ email: "jane@example.com" });

    const resendButton = await screen.findByRole("button", { name: /resend verification email/i });
    await user.click(resendButton);

    expect(supabase.auth.resend).toHaveBeenCalledTimes(1);
    const cooldownButton = await screen.findByRole("button", { name: /resend available in/i });
    expect(cooldownButton).toBeDisabled();

    await user.click(cooldownButton);
    expect(supabase.auth.resend).toHaveBeenCalledTimes(1);
  });

  it("shows a user-facing error when the resend request fails", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: new AuthError("Email rate limit exceeded"),
    } as unknown as ResendResult);
    mockAuthStateChange();

    const user = userEvent.setup();
    renderVerifyEmail({ email: "jane@example.com" });

    await user.click(await screen.findByRole("button", { name: /resend verification email/i }));

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });
});
