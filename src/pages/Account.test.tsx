import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Account from "./Account";

const signOut = vi.fn();
const deleteMutate = vi.fn();

let userState: {
  data: { email: string; created_at: string } | null | undefined;
  isLoading: boolean;
  isError: boolean;
};
let deleteState: { isPending: boolean; isError: boolean; error: Error | null } = {
  isPending: false,
  isError: false,
  error: null,
};

vi.mock("../features/user/userUser", () => ({
  useUser: () => ({ ...userState, refetch: vi.fn() }),
}));

vi.mock("../features/user/useSignOut", () => ({
  useSignOut: () => signOut,
}));

vi.mock("../features/profiles/useDeleteUser", () => ({
  useDeleteUser: () => ({
    mutate: deleteMutate,
    get isPending() {
      return deleteState.isPending;
    },
    get isError() {
      return deleteState.isError;
    },
    get error() {
      return deleteState.error;
    },
  }),
}));

function baseUser() {
  return { email: "jordan@nexali.app", created_at: "2024-03-15T00:00:00.000Z" };
}

describe("Account page", () => {
  afterEach(() => {
    vi.clearAllMocks();
    deleteState = { isPending: false, isError: false, error: null };
  });

  it("renders the page heading", () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    renderWithProviders(<Account />);
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
  });

  it("renders the real sign-in email from Supabase Auth as a read-only field", () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    renderWithProviders(<Account />);

    const emailInput = screen.getByLabelText(/current email/i);
    expect(emailInput).toHaveValue("jordan@nexali.app");
    expect(emailInput).toBeDisabled();
  });

  it("shows real member-since text derived from the real auth created_at", () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    renderWithProviders(<Account />);
    expect(screen.getByText(/member since march 2024/i)).toBeInTheDocument();
  });

  it("shows a loading state without rendering account data", () => {
    userState = { data: undefined, isLoading: true, isError: false };
    renderWithProviders(<Account />);

    expect(screen.queryByRole("heading", { name: "Account" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/current email/i)).not.toBeInTheDocument();
    expect(screen.getByText(/loading account/i)).toBeInTheDocument();
  });

  it("shows a retryable error state when the real auth user fails to load", () => {
    userState = { data: null, isLoading: false, isError: true };
    renderWithProviders(<Account />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("offers a truthful Change password action that routes to the real forgot-password flow, with no fake password fields", () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    renderWithProviders(<Account />);

    const link = screen.getByRole("link", { name: /change password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
  });

  it("does not present unsupported Lovable security controls as working", () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    renderWithProviders(<Account />);

    expect(screen.queryByText(/two-factor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/active sessions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connected accounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/export your data/i)).not.toBeInTheDocument();
  });

  it("never renders Lovable's mock account/session data", () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    renderWithProviders(<Account />);

    expect(screen.queryByText(/jordan\.van@nexali\.app/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/macbook pro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/chase total checking/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/google calendar/i)).not.toBeInTheDocument();
  });

  it("does not duplicate Profile's identity editing on Account", () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    renderWithProviders(<Account />);

    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/change profile photo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/financial bio/i)).not.toBeInTheDocument();
  });

  it("does not include Settings-owned app preference controls on Account", () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    renderWithProviders(<Account />);

    expect(screen.queryByLabelText(/budget reset cycle/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/preferred currency/i)).not.toBeInTheDocument();
  });

  it("renders the Danger zone with a real delete action", () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    renderWithProviders(<Account />);

    expect(screen.getByText(/danger zone/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete my account/i })).toBeInTheDocument();
  });

  it("opens a real typed-confirmation dialog instead of window.confirm", async () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    const user = userEvent.setup();
    renderWithProviders(<Account />);

    await user.click(screen.getByRole("button", { name: /delete my account/i }));

    expect(await screen.findByText(/delete your account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type delete to confirm/i)).toBeInTheDocument();
  });

  it("keeps the confirm button disabled until DELETE is typed exactly", async () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    const user = userEvent.setup();
    renderWithProviders(<Account />);

    await user.click(screen.getByRole("button", { name: /delete my account/i }));
    await screen.findByLabelText(/type delete to confirm/i);
    const dialogConfirm = screen.getByRole("button", { name: /delete my account/i });
    expect(dialogConfirm).toBeDisabled();

    await user.type(screen.getByLabelText(/type delete to confirm/i), "nope");
    expect(dialogConfirm).toBeDisabled();

    await user.clear(screen.getByLabelText(/type delete to confirm/i));
    await user.type(screen.getByLabelText(/type delete to confirm/i), "DELETE");
    expect(dialogConfirm).toBeEnabled();
  });

  it("cancel closes the dialog without calling the real delete mutation", async () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    const user = userEvent.setup();
    renderWithProviders(<Account />);

    await user.click(screen.getByRole("button", { name: /delete my account/i }));
    await user.click(await screen.findByRole("button", { name: /cancel/i }));

    expect(deleteMutate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/type delete to confirm/i)).not.toBeInTheDocument();
  });

  it("invokes the real deletion mutation only after typed confirmation", async () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    const user = userEvent.setup();
    renderWithProviders(<Account />);

    await user.click(screen.getByRole("button", { name: /delete my account/i }));
    await user.type(await screen.findByLabelText(/type delete to confirm/i), "DELETE");
    await user.click(screen.getByRole("button", { name: /delete my account/i }));

    expect(deleteMutate).toHaveBeenCalledTimes(1);
  });

  it("shows a deleting state and prevents duplicate submissions while pending", async () => {
    deleteState = { isPending: true, isError: false, error: null };
    userState = { data: baseUser(), isLoading: false, isError: false };
    const user = userEvent.setup();
    renderWithProviders(<Account />);

    await user.click(screen.getByRole("button", { name: /delete my account/i }));
    const dialogConfirm = await screen.findByRole("button", { name: /deleting/i });
    expect(dialogConfirm).toBeDisabled();
  });

  it("shows a safe error message and keeps the page usable when deletion fails", async () => {
    deleteState = { isPending: false, isError: true, error: new Error("permission denied for table profiles") };
    userState = { data: baseUser(), isLoading: false, isError: false };
    const user = userEvent.setup();
    renderWithProviders(<Account />);

    await user.click(screen.getByRole("button", { name: /delete my account/i }));

    expect(await screen.findByText(/permission denied for table profiles/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account", hidden: true })).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("calls the real sign-out redirect flow after a successful deletion", async () => {
    userState = { data: baseUser(), isLoading: false, isError: false };
    const user = userEvent.setup();
    renderWithProviders(<Account />);

    deleteMutate.mockImplementation((_vars, opts) => {
      opts.onSuccess();
    });

    await user.click(screen.getByRole("button", { name: /delete my account/i }));
    await user.type(await screen.findByLabelText(/type delete to confirm/i), "DELETE");
    await user.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});
