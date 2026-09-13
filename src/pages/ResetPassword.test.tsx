import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ResetPassword from "./ResetPassword";

vi.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

import { supabase } from "../supabaseClient";

type AuthChangeCallback = Parameters<typeof supabase.auth.onAuthStateChange>[0];
type OnAuthStateChangeResult = ReturnType<typeof supabase.auth.onAuthStateChange>;
type GetSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
type UpdateUserResult = Awaited<ReturnType<typeof supabase.auth.updateUser>>;

function mockAuthStateChange() {
  let callback: AuthChangeCallback = () => {};
  const unsubscribe = vi.fn();
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
    callback = cb;
    return {
      data: { subscription: { id: "sub", callback: cb, unsubscribe } },
    } as unknown as OnAuthStateChangeResult;
  });
  return {
    fire: (event: string) => act(() => callback(event as never, null)),
  };
}

function renderResetPassword(hash = "") {
  window.location.hash = hash;
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ResetPassword", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
  });

  it("shows an invalid-link message when Supabase reports an expired link via hash params", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    mockAuthStateChange();

    renderResetPassword("#error=access_denied&error_code=otp_expired&error_description=expired");

    expect(await screen.findByText(/expired/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request a new reset link/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it("treats a missing recovery session as invalid rather than an editable form", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    mockAuthStateChange();

    renderResetPassword();

    expect(
      await screen.findByText(/invalid or has expired/i, {}, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it("shows the new-password form once Supabase reports a valid recovery session", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    const { fire } = mockAuthStateChange();

    renderResetPassword();
    fire("PASSWORD_RECOVERY");

    expect(await screen.findByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });

  it("rejects a mismatched password confirmation before calling Supabase", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    const { fire } = mockAuthStateChange();

    const user = userEvent.setup();
    renderResetPassword();
    fire("PASSWORD_RECOVERY");

    await user.type(await screen.findByLabelText(/^new password$/i), "hunter22");
    await user.type(screen.getByLabelText(/confirm new password/i), "different1");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect((await screen.findAllByText(/passwords do not match/i)).length).toBeGreaterThan(0);
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and shows a success state with a path to the dashboard", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as unknown as UpdateUserResult);
    const { fire } = mockAuthStateChange();

    const user = userEvent.setup();
    renderResetPassword();
    fire("PASSWORD_RECOVERY");

    await user.type(await screen.findByLabelText(/^new password$/i), "hunter22");
    await user.type(screen.getByLabelText(/confirm new password/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(await screen.findByText(/password has been updated/i)).toBeInTheDocument();
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "hunter22" });

    await user.click(screen.getByRole("button", { name: /continue to dashboard/i }));
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("shows an advisory password-strength meter without raising the real 6-character minimum", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as GetSessionResult);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as unknown as UpdateUserResult);
    const { fire } = mockAuthStateChange();

    const user = userEvent.setup();
    renderResetPassword();
    fire("PASSWORD_RECOVERY");

    const passwordField = await screen.findByLabelText(/^new password$/i);
    expect(screen.getByText(/strength: empty/i)).toBeInTheDocument();

    await user.type(passwordField, "hunter22");
    expect(await screen.findByText(/strength: fair/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/confirm new password/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "hunter22" }));
  });
});
