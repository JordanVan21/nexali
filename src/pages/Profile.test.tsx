import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Profile from "./Profile";

const updateMutate = vi.fn();
let profileState: {
  data: { full_name: string | null; avatar_url: string | null; budget_reset_cycle: string; reset_day: number; timezone: string } | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};
let updateState: { isPending: boolean } = { isPending: false };
let uploadState: { isPending: boolean; isSuccess: boolean; isError: boolean; error: Error | null } = {
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
};
let deleteAvatarState: { isPending: boolean; isSuccess: boolean; isError: boolean; error: Error | null } = {
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
};
const uploadMutate = vi.fn();
const deleteAvatarMutate = vi.fn();

vi.mock("../features/profiles/useProfile", () => ({
  useProfile: () => ({ ...profileState, refetch: vi.fn() }),
  useUpdateProfile: () => ({
    mutate: updateMutate,
    get isPending() {
      return updateState.isPending;
    },
  }),
}));

vi.mock("../features/profiles/useAvatar", () => ({
  useUploadAvatar: () => ({
    mutate: uploadMutate,
    get isPending() {
      return uploadState.isPending;
    },
    get isSuccess() {
      return uploadState.isSuccess;
    },
    get isError() {
      return uploadState.isError;
    },
    get error() {
      return uploadState.error;
    },
  }),
  useDeleteAvatar: () => ({
    mutate: deleteAvatarMutate,
    get isPending() {
      return deleteAvatarState.isPending;
    },
    get isSuccess() {
      return deleteAvatarState.isSuccess;
    },
    get isError() {
      return deleteAvatarState.isError;
    },
    get error() {
      return deleteAvatarState.error;
    },
  }),
}));

vi.mock("../features/user/userUser", () => ({
  useUser: () => ({ data: { created_at: "2024-03-15T00:00:00.000Z" } }),
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

describe("Profile page", () => {
  afterEach(() => {
    vi.clearAllMocks();
    updateState = { isPending: false };
    uploadState = { isPending: false, isSuccess: false, isError: false, error: null };
    deleteAvatarState = { isPending: false, isSuccess: false, isError: false, error: null };
  });

  it("renders the page heading and real profile data", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Jamie Rivera");
  });

  it("renders the real sign-in email as a read-only field", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveValue("test@example.com");
    expect(emailInput).toBeDisabled();
  });

  it("shows a loading state without rendering profile values", () => {
    profileState = { data: undefined, isLoading: true, isError: false, error: null };
    renderWithProviders(<Profile />);

    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
    expect(screen.queryByText("Jamie Rivera")).not.toBeInTheDocument();
    expect(screen.getByText(/loading profile/i)).toBeInTheDocument();
  });

  it("shows a retryable error state when the profile query fails", () => {
    profileState = { data: null, isLoading: false, isError: true, error: new Error("network down") };
    renderWithProviders(<Profile />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("shows a real avatar image when avatar_url is set", () => {
    profileState = { data: { ...baseProfile(), avatar_url: "https://example.com/avatar.jpg" }, isLoading: false, isError: false, error: null };
    const { container } = renderWithProviders(<Profile />);

    const images = Array.from(container.querySelectorAll("img"));
    expect(images.some((img) => img.src.includes("example.com/avatar.jpg"))).toBe(true);
  });

  it("falls back to the neutral placeholder image when there is no real avatar", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const { container } = renderWithProviders(<Profile />);

    const images = Array.from(container.querySelectorAll("img"));
    expect(images.some((img) => img.src.includes("blank_profile_pic"))).toBe(true);
  });

  it("does not offer Remove current when there is no real avatar", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);
    expect(screen.queryByRole("button", { name: /remove current/i })).not.toBeInTheDocument();
  });

  it("offers Remove current when a real avatar exists", () => {
    profileState = { data: { ...baseProfile(), avatar_url: "https://example.com/avatar.jpg" }, isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);
    expect(screen.getByRole("button", { name: /remove current/i })).toBeInTheDocument();
  });

  it("requires confirmation before removing the avatar", async () => {
    profileState = { data: { ...baseProfile(), avatar_url: "https://example.com/avatar.jpg" }, isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Profile />);

    await user.click(screen.getByRole("button", { name: /remove current/i }));
    expect(await screen.findByText(/remove profile photo\?/i)).toBeInTheDocument();
    expect(deleteAvatarMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(deleteAvatarMutate).toHaveBeenCalled();
  });

  it("uploads a selected file via the real avatar mutation", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Profile />);

    const file = new File(["fake"], "photo.png", { type: "image/png" });
    const [fileInput] = screen.getAllByLabelText(/change profile photo|upload new photo/i, { selector: "input" });
    await user.upload(fileInput as HTMLInputElement, file);

    expect(uploadMutate).toHaveBeenCalledWith(file);
  });

  it("shows an upload error without breaking the rest of the page", () => {
    uploadState = { isPending: false, isSuccess: false, isError: true, error: new Error("Upload failed") };
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  it("disables Save and Discard until the form is actually dirty, and enables Save after an edit", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Profile />);

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discard changes/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/full name/i), " Jr.");

    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /discard changes/i })).toBeEnabled();
  });

  it("discard resets the form back to the loaded profile values", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Profile />);

    await user.type(screen.getByLabelText(/full name/i), " Jr.");
    await user.click(screen.getByRole("button", { name: /discard changes/i }));

    expect(screen.getByLabelText(/full name/i)).toHaveValue("Jamie Rivera");
  });

  it("calls the real update mutation with the edited full name and existing preferences", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Profile />);

    await user.clear(screen.getByLabelText(/full name/i));
    await user.type(screen.getByLabelText(/full name/i), "New Name");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateMutate).toHaveBeenCalledWith(
      {
        full_name: "New Name",
        budget_reset_cycle: "monthly",
        reset_day: 1,
      },
      expect.anything()
    );
  });

  it("rejects an empty full name without calling the mutation", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Profile />);

    await user.clear(screen.getByLabelText(/full name/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("shows the saving state while the mutation is pending", () => {
    updateState = { isPending: true };
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("shows success feedback and preserves entered text after a failed save", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Profile />);

    updateMutate.mockImplementation((_vars, opts) => {
      opts.onError(new Error("Failed to update profile!"));
    });

    await user.clear(screen.getByLabelText(/full name/i));
    await user.type(screen.getByLabelText(/full name/i), "Attempted Name");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/failed to update profile/i));
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Attempted Name");
  });

  it("never renders Lovable's mock profile data", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    expect(screen.queryByText("Jordan Van")).not.toBeInTheDocument();
    expect(screen.queryByText(/jordan\.van@nexali\.app/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nexali plus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/san francisco/i)).not.toBeInTheDocument();
  });

  it("omits unsupported Lovable fields and Account destructive actions", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/location/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/financial bio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delete user/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delete account/i)).not.toBeInTheDocument();
  });

  it("still offers the real, working Budget Reset Cycle and Reset Day preferences", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    expect(screen.getByLabelText(/budget reset cycle/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reset day/i)).toBeInTheDocument();
  });

  it("displays Preferred currency as a static USD ($) value, not an editable control", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    expect(screen.getByText(/preferred currency/i)).toBeInTheDocument();
    expect(screen.getByText("USD ($)")).toBeInTheDocument();
    expect(screen.queryByLabelText(/preferred currency/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /currency/i })).not.toBeInTheDocument();
  });

  it("displays the real current Timezone as static text, not an editable control", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    const timezoneLabel = screen.getByText("Timezone");
    const timezoneRow = timezoneLabel.closest("div")?.parentElement;
    expect(timezoneRow).toHaveTextContent("America/Los_Angeles");
    expect(screen.queryByLabelText(/^timezone$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /timezone/i })).not.toBeInTheDocument();
  });

  it("does not render any select, input, or combobox for currency or timezone", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    // Only the real editable controls remain comboboxes: Budget reset cycle.
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes).toHaveLength(1);
    expect(comboboxes[0]).toHaveAccessibleName(/budget reset cycle/i);
  });

  it("does not let Preferred currency or Timezone affect Profile dirty state", () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    renderWithProviders(<Profile />);

    // Static text only -- there is no control to interact with, and editing
    // the real editable field (Full name) is the only thing that should
    // enable Save/Discard.
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /discard changes/i })).toBeDisabled();
  });

  it("never includes currency or timezone in the Save mutation payload", async () => {
    profileState = { data: baseProfile(), isLoading: false, isError: false, error: null };
    const user = userEvent.setup();
    renderWithProviders(<Profile />);

    await user.type(screen.getByLabelText(/full name/i), " Jr.");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [payload] = updateMutate.mock.calls[0];
    expect(payload).not.toHaveProperty("timezone");
    expect(payload).not.toHaveProperty("currency");
  });
});
