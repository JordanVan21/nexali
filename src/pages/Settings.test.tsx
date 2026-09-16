import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Settings from "./Settings";

const updateSettingsMutateAsync = vi.fn();

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
type MockPreferences = {
  budget_approaching: boolean;
  budget_exceeded: boolean;
  monthly_summary: boolean;
  account_security: boolean;
};

let profileState: {
  data: MockProfile | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};
let preferencesState: {
  data: MockPreferences | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};
let updateSettingsState: { isPending: boolean } = { isPending: false };

vi.mock("../features/profiles/useProfile", () => ({
  useProfile: () => ({ ...profileState, refetch: vi.fn() }),
}));

vi.mock("../features/notifications/useNotifications", () => ({
  useNotificationPreferences: () => ({ ...preferencesState, refetch: vi.fn() }),
}));

vi.mock("../features/settings/useUpdateUserSettings", () => ({
  useUpdateUserSettings: () => ({
    mutateAsync: updateSettingsMutateAsync,
    get isPending() {
      return updateSettingsState.isPending;
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

function basePreferences(overrides: Partial<MockPreferences> = {}): MockPreferences {
  return {
    budget_approaching: true,
    budget_exceeded: true,
    monthly_summary: true,
    account_security: true,
    ...overrides,
  };
}

function loaded(profileOverrides: Partial<MockProfile> = {}, prefOverrides: Partial<MockPreferences> = {}) {
  profileState = { data: baseProfile(profileOverrides), isLoading: false, isError: false, error: null };
  preferencesState = { data: basePreferences(prefOverrides), isLoading: false, isError: false, error: null };
}

describe("Settings page", () => {
  afterEach(() => {
    vi.clearAllMocks();
    updateSettingsState = { isPending: false };
    updateSettingsMutateAsync.mockResolvedValue(undefined);
  });

  it("renders the page heading", () => {
    loaded();
    renderWithProviders(<Settings />);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("shows a loading state without rendering settings values", () => {
    profileState = { data: undefined, isLoading: true, isError: false, error: null };
    preferencesState = { data: undefined, isLoading: true, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
  });

  it("shows a loading state while only preferences is still loading (profile already resolved)", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    preferencesState = { data: undefined, isLoading: true, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("shows a retryable error state when the profile query fails", () => {
    profileState = { data: null, isLoading: false, isError: true, error: new Error("network down") };
    preferencesState = { data: basePreferences(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Settings />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("shows a retryable error state when the notification-preferences query fails (even if profile succeeds)", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    preferencesState = { data: null, isLoading: false, isError: true, error: new Error("permission denied") };
    renderWithProviders(<Settings />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("loads the real persisted timezone value into an editable control", () => {
    loaded();
    renderWithProviders(<Settings />);

    expect(screen.getByRole("combobox", { name: /^timezone$/i })).toHaveTextContent(/pacific time/i);
  });

  describe("Default currency / Date format / Number format (real persistence)", () => {
    it("renders them as real, ENABLED controls with no 'Coming soon' caption", () => {
      loaded();
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
      loaded({ currency: "EUR" });
      renderWithProviders(<Settings />);

      expect(screen.getByRole("combobox", { name: /default currency/i })).toHaveTextContent(/EUR \(€\)/);
    });

    it("editing currency/date-format/number-format makes the page dirty", async () => {
      loaded();
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

      await user.click(screen.getByRole("combobox", { name: /default currency/i }));
      await user.click(await screen.findByText(/EUR \(€\)/));

      expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
    });
  });

  it("shows Appearance as dark-only, with no fake Light or System mode control", () => {
    loaded();
    renderWithProviders(<Settings />);

    expect(screen.getByText(/nexali obsidian dark/i)).toBeInTheDocument();
    expect(screen.queryByText(/light mode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/system mode/i)).not.toBeInTheDocument();
  });

  describe("Notification preferences (real persistence, Backend Part 7)", () => {
    it("renders the real Lovable notification-preference rows", () => {
      loaded();
      renderWithProviders(<Settings />);

      expect(screen.getByText("Budget approaching limit")).toBeInTheDocument();
      expect(screen.getByText("Budget exceeded")).toBeInTheDocument();
      expect(screen.getByText("Monthly financial summary")).toBeInTheDocument();
      expect(screen.getByText("Account and security notifications")).toBeInTheDocument();
      expect(screen.queryAllByText(/coming soon/i).length).toBeGreaterThanOrEqual(2); // still present for Reduce animations/Show chart values
    });

    it("renders the four notification switches as real, ENABLED controls", () => {
      loaded();
      renderWithProviders(<Settings />);

      const switches = screen.getAllByRole("switch");
      expect(switches).toHaveLength(4);
      for (const s of switches) {
        expect(s).not.toBeDisabled();
      }
    });

    it("loads the real persisted preference values, including a mixed on/off state", () => {
      loaded({}, { budget_approaching: true, budget_exceeded: false, monthly_summary: true, account_security: false });
      renderWithProviders(<Settings />);

      expect(screen.getByLabelText("Budget approaching limit")).toHaveAttribute("aria-checked", "true");
      expect(screen.getByLabelText("Budget exceeded")).toHaveAttribute("aria-checked", "false");
      expect(screen.getByLabelText("Monthly financial summary")).toHaveAttribute("aria-checked", "true");
      expect(screen.getByLabelText("Account and security notifications")).toHaveAttribute("aria-checked", "false");
    });

    it("toggling a switch makes the page dirty", async () => {
      loaded();
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
      await user.click(screen.getByLabelText("Budget exceeded"));
      expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
    });

    it("discard restores the toggle to its last persisted value", async () => {
      loaded();
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await user.click(screen.getByLabelText("Budget exceeded"));
      expect(screen.getByLabelText("Budget exceeded")).toHaveAttribute("aria-checked", "false");

      await user.click(screen.getByRole("button", { name: /discard changes/i }));
      expect(screen.getByLabelText("Budget exceeded")).toHaveAttribute("aria-checked", "true");
    });

    it("a failed save preserves the toggled switch state", async () => {
      loaded();
      updateSettingsMutateAsync.mockRejectedValue(new Error("permission denied for table notification_preferences"));
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await user.click(screen.getByLabelText("Budget exceeded"));
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(/permission denied for table notification_preferences/i)
      );
      expect(screen.getByLabelText("Budget exceeded")).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("Atomic save via update_user_settings RPC (Backend Part 7 fix)", () => {
    it("performs exactly ONE mutation call for a save, not two independent writes", async () => {
      loaded();
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
      await user.click(await screen.findByText(/eastern time/i));
      await user.click(screen.getByLabelText("Budget exceeded"));
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => expect(updateSettingsMutateAsync).toHaveBeenCalledTimes(1));
    });

    it("the single RPC payload includes all eight real Settings values", async () => {
      loaded();
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await user.click(screen.getByRole("combobox", { name: /default currency/i }));
      await user.click(await screen.findByText(/EUR \(€\)/));
      await user.click(screen.getByLabelText("Budget exceeded"));
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => expect(updateSettingsMutateAsync).toHaveBeenCalledTimes(1));
      const [payload] = updateSettingsMutateAsync.mock.calls[0];
      expect(payload).toEqual({
        timezone: "America/Los_Angeles",
        currency: "EUR",
        dateFormat: "mdy",
        numberFormat: "standard",
        notifyApproaching: true,
        notifyExceeded: false,
        notifySummary: true,
        notifySecurity: true,
        previousTimezone: "America/Los_Angeles",
      });
    });

    it("never sends an arbitrary/client-supplied user id in the RPC payload", async () => {
      loaded();
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
      await user.click(await screen.findByText(/eastern time/i));
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => expect(updateSettingsMutateAsync).toHaveBeenCalledTimes(1));
      const [payload] = updateSettingsMutateAsync.mock.calls[0];
      expect(Object.keys(payload)).not.toContain("user_id");
      expect(Object.keys(payload)).not.toContain("userId");
      expect(Object.keys(payload)).not.toContain("p_user_id");
    });

    it("includes previousTimezone so the mutation hook can tell whether timezone actually changed", async () => {
      loaded({ timezone: "America/Chicago" });
      const user = userEvent.setup();
      renderWithProviders(<Settings />);

      await user.click(screen.getByRole("combobox", { name: /default currency/i }));
      await user.click(await screen.findByText(/EUR \(€\)/));
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => expect(updateSettingsMutateAsync).toHaveBeenCalledTimes(1));
      const [payload] = updateSettingsMutateAsync.mock.calls[0];
      expect(payload.timezone).toBe("America/Chicago");
      expect(payload.previousTimezone).toBe("America/Chicago");
    });
  });

  it("does not duplicate Profile's Budget reset cycle/day editing controls", () => {
    loaded();
    renderWithProviders(<Settings />);

    expect(screen.queryByLabelText(/budget reset cycle/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/reset day/i)).not.toBeInTheDocument();
  });

  it("does not duplicate Profile identity or Account security controls", () => {
    loaded();
    renderWithProviders(<Settings />);

    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/danger zone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delete my account/i)).not.toBeInTheDocument();
  });

  it("never renders Lovable's mock settings/session data", () => {
    loaded();
    renderWithProviders(<Settings />);

    expect(screen.queryByText(/jordan\.van@nexali\.app/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/macbook pro/i)).not.toBeInTheDocument();
  });

  it("disables Save and Discard until a real preference actually changes", async () => {
    loaded();
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
    loaded();
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

  it("shows the saving state while the atomic mutation is pending", () => {
    updateSettingsState = { isPending: true };
    loaded();
    renderWithProviders(<Settings />);

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("shows success feedback after a real atomic save", async () => {
    loaded();
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/settings saved/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /discard changes/i })).toBeDisabled();
  });

  it("shows safe failure feedback and preserves every local edit (not just timezone) after a failed atomic save", async () => {
    loaded();
    updateSettingsMutateAsync.mockRejectedValue(new Error("permission denied for table profiles"));
    const user = userEvent.setup();
    renderWithProviders(<Settings />);

    await user.click(screen.getByRole("combobox", { name: /^timezone$/i }));
    await user.click(await screen.findByText(/eastern time/i));
    await user.click(screen.getByRole("combobox", { name: /default currency/i }));
    await user.click(await screen.findByText(/EUR \(€\)/));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/permission denied for table profiles/i));
    expect(screen.getByRole("combobox", { name: /^timezone$/i })).toHaveTextContent(/eastern time/i);
    expect(screen.getByRole("combobox", { name: /default currency/i })).toHaveTextContent(/EUR \(€\)/);
    // Failure never reports success and never advances the saved baseline.
    expect(screen.queryByText(/settings saved/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /discard changes/i })).toBeEnabled();
  });
});
