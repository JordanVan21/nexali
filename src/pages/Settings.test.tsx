import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Settings from "./Settings";

const updateMutate = vi.fn();
type MockProfile = {
  full_name: string | null;
  avatar_url: string | null;
  budget_reset_cycle: string;
  reset_day: number;
  timezone: string;
  phone: string | null;
  location: string | null;
  financial_bio: string | null;
  currency: string;
  date_format: string;
  number_format: string;
};
let profileState: {
  data: MockProfile | null | undefined;
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

function baseProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    full_name: "Jamie Rivera",
    avatar_url: null,
    budget_reset_cycle: "monthly",
    reset_day: 1,
    timezone: "America/Los_Angeles",
    phone: null,
    location: null,
    financial_bio: null,
    currency: "USD",
    date_format: "mdy",
    number_format: "standard",
    ...overrides,
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

  describe("Default currency / Date format / Number format (real persistence)", () => {
    it("renders them as real, ENABLED controls with no 'Coming soon' caption", () => {
      profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
      renderWithProviders(<Settings />);

      const currency = screen.getByRole("combobox", { name: /default currency/i });
      const dateFormat = screen.getByRole("combobox", { name: /date format/i });
      const numberFormat = screen.getByRole("combobox", { name: /number format/i });

      expect(currency).not.toBeDisabled();
      expect(dateFormat).not.toBeDisabled();
      expect(numberFormat).not.toBeDisabled();
      expect(screen.queryByText(/coming soon.*currency|currency.*coming soon/i)).not.toBeInTheDocument();
    });

    it("loads the real persisted currency", () => {
      profileState = { data: baseProfile({ currency: "EUR" }), isLoading: false, isError: false, error: null };
      renderWithProviders(<Settings />);

      expect(screen.getByRole("combobox", { name: /default currency/i })).toHaveTextContent(/EUR \(€\)/);
    });

    it("loads the real persisted date format", () => {
      profileState = { data: baseProfile({ date_format: "dmy" }), isLoading: false, isError: false, error: null };
      renderWithProviders(<Settings />);

      expect(screen.getByRole("combobox", { name: /date format/i })).toHaveTextContent("DD/MM/YYYY");
      expect(screen.getByText("24/10/2025")).toBeInTheDocument();
    });

    it("loads the real persisted number format", () => {
      profileState = { data: baseProfile({ number_format: "european" }), isLoading: false, isError: false, error: null };
      renderWithProviders(<Settings />);

      expect(screen.getByRole("combobox", { name: /number format/i })).toHaveTextContent(/1\.234,56/);
    });

    it("editing currency/date-format/number-format makes the page dirty", async () => {
      profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

      await user.click(screen.getByRole("combobox", { name: /default currency/i }));
      await user.click(await screen.findByText(/EUR \(€\)/));

      expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
    });
  });

  it("shows Appearance as dark-only, with no fake Light or System mode control", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.getByText(/nexali obsidian dark/i)).toBeInTheDocument();
    expect(screen.queryByText(/light mode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/system mode/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("renders the Notifications section as backend-pending, not as working toggles", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.getByText(/budget approaching limit/i)).toBeInTheDocument();
    expect(screen.getAllByRole("switch").every((s) => s.hasAttribute("disabled"))).toBe(true);
  });

  it("keeps Reduce animations and Show chart values as backend-pending, not real toggles", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.getByText(/reduce animations/i)).toBeInTheDocument();
    expect(screen.getByText(/show values on charts/i)).toBeInTheDocument();
    // Still captioned as pending -- these two, unlike currency/date/number,
    // have no backing column or app-wide behavior yet.
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThanOrEqual(2);
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

  it("disables Save and Discard until a real preference actually changes", async () => {
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

  it("discard resets ALL real editable fields back to the loaded values, not just some", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));
    await user.click(screen.getByRole("combobox", { name: /default currency/i }));
    await user.click(await screen.findByText(/EUR \(€\)/));

    await user.click(screen.getByRole("button", { name: /discard changes/i }));

    expect(screen.getByRole("combobox", { name: /^timezone$/i })).toHaveTextContent(/pacific time/i);
    expect(screen.getByRole("combobox", { name: /default currency/i })).toHaveTextContent(/USD \(\$\)/);
  });

  it("saves the full set of real preferences in one coherent update, even when only one changed", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate).toHaveBeenCalledWith(
      { timezone: "America/New_York", currency: "USD", date_format: "mdy", number_format: "standard" },
      expect.anything()
    );
  });

  it("saves multiple changed preferences together in exactly one mutation call", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));
    await user.click(screen.getByRole("combobox", { name: /default currency/i }));
    await user.click(await screen.findByText(/EUR \(€\)/));
    await user.click(screen.getByRole("combobox", { name: /number format/i }));
    await user.click(await screen.findByText(/1\.234,56/));

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate).toHaveBeenCalledWith(
      { timezone: "America/New_York", currency: "EUR", date_format: "mdy", number_format: "european" },
      expect.anything()
    );
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
    // The just-saved value is now the baseline -- Discard goes disabled again.
    expect(screen.getByRole("button", { name: /discard changes/i })).toBeDisabled();
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

  it("renders the real Lovable notification-preference rows", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.getByText("Budget approaching limit")).toBeInTheDocument();
    expect(screen.getByText("Budget exceeded")).toBeInTheDocument();
    expect(screen.getByText("Monthly financial summary")).toBeInTheDocument();
    expect(screen.getByText("Account and security notifications")).toBeInTheDocument();
  });

  it("keeps every notification-preference switch disabled and unchecked, not persisted", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(4);
    for (const s of switches) {
      expect(s).toBeDisabled();
      expect(s).toHaveAttribute("aria-checked", "false");
    }
  });

  it("does not let notification preferences, reduce-animations, or show-chart-values affect Settings dirty state", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    // Every backend-pending control on the page is disabled -- there is
    // nothing to interact with, so dirty state can only ever come from the
    // four real editable fields.
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discard changes/i })).toBeDisabled();
  });

  it("never includes notification/appearance preferences in the Save payload", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [payload] = updateMutate.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual(["currency", "date_format", "number_format", "timezone"]);
  });
});
