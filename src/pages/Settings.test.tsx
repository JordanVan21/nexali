import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Settings from "./Settings";

const updateMutate = vi.fn();
let profileState: {
  data: { full_name: string | null; avatar_url: string | null; budget_reset_cycle: string; reset_day: number; timezone: string } | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};
let updateState: { isPending: boolean } = { isPending: false };

vi.mock("../features/profiles/useProfile", () => ({
  useProfile: () => ({ ...profileState, refetch: vi.fn() }),
  useUpdateProfile: () => ({
    mutate: updateMutate,
    get isPending() {
      return updateState.isPending;
    },
  }),
}));

function baseProfile() {
  return {
    full_name: "Jamie Rivera",
    avatar_url: null as string | null,
    budget_reset_cycle: "monthly",
    reset_day: 1,
    timezone: "America/Los_Angeles",
  };
}

describe("Settings page", () => {
  afterEach(() => {
    vi.clearAllMocks();
    updateState = { isPending: false };
  });

  it("renders the page heading", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("shows a loading state without rendering settings values", () => {
    profileState = { data: undefined, isLoading: true, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
  });

  it("shows a retryable error state when the settings/profile query fails", () => {
    profileState = { data: null, isLoading: false, isError: true, error: new Error("network down") };
    renderWithProviders(<Settings />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("loads the real persisted timezone value into an editable control", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.getByRole("combobox", { name: /^timezone$/i })).toHaveTextContent(/pacific time/i);
  });

  it("shows Default currency, Date format and Number format as disabled, not persisted", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.getByRole("combobox", { name: /default currency/i })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /date format/i })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /number format/i })).toBeDisabled();
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThanOrEqual(3);
  });

  it("defaults currency to USD ($), never a fabricated stored preference", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.getByRole("combobox", { name: /default currency/i })).toHaveTextContent(/USD \(\$\)/);
  });

  it("shows Appearance as dark-only, with no fake Light or System mode control", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.getByText(/nexali obsidian dark/i)).toBeInTheDocument();
    expect(screen.queryByText(/light mode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/system mode/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("does not render a Notifications section", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.queryByText(/budget approaching limit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/notify/i)).not.toBeInTheDocument();
  });

  it("does not render Aura assistant preference toggles", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.queryByText(/response detail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/use my financial data/i)).not.toBeInTheDocument();
  });

  it("does not duplicate Profile's Budget reset cycle/day editing controls", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.queryByLabelText(/budget reset cycle/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/reset day/i)).not.toBeInTheDocument();
  });

  it("does not duplicate Profile identity or Account security controls", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/danger zone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delete my account/i)).not.toBeInTheDocument();
  });

  it("never renders Lovable's mock settings/session data", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.queryByText(/jordan\.van@nexali\.app/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/macbook pro/i)).not.toBeInTheDocument();
  });

  it("disables Save and Discard until timezone actually changes", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discard changes/i })).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));

    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /discard changes/i })).toBeEnabled();
  });

  it("discard resets timezone back to the loaded value", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));
    await user.click(screen.getByRole("button", { name: /discard changes/i }));

    expect(screen.getByRole("combobox", { name: /^timezone$/i })).toHaveTextContent(/pacific time/i);
  });

  it("calls the real update mutation with only the changed timezone", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateMutate).toHaveBeenCalledWith({ timezone: "America/New_York" }, expect.anything());
  });

  it("shows the saving state while the mutation is pending", () => {
    updateState = { isPending: true };
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("shows success feedback after a real save", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    updateMutate.mockImplementation((_vars, opts) => {
      opts.onSuccess();
    });

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/settings saved/i)).toBeInTheDocument());
  });

  it("shows safe failure feedback and preserves the entered timezone after a failed save", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    updateMutate.mockImplementation((_vars, opts) => {
      opts.onError(new Error("permission denied for table profiles"));
    });

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/permission denied for table profiles/i));
    expect(screen.getByRole("combobox", { name: /^timezone$/i })).toHaveTextContent(/eastern time/i);
  });
});
