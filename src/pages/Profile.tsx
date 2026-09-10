import blankProfile from "../assets/blank_profile_pic.jpg";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.ts";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useProfile,
  useUpdateProfile,
} from "../features/profiles/useProfile.ts";
import {
  useUploadAvatar,
  useDeleteAvatar,
} from "../features/profiles/useAvatar.ts";
import { useDeleteUser } from "../features/profiles/useDeleteUser.ts";
import { useUserInfo } from "../shared/useUserId.ts";
import { getErrorMessage } from "../lib/utils.ts";
import { Label } from "../components/ui/label.tsx";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select.tsx";

const FRIENDLY: Record<string, string> = {
  "America/Los_Angeles": "Pacific Time",
  "America/Denver": "Mountain Time",
  "America/Chicago": "Central Time",
  "America/New_York": "Eastern Time",
  "Europe/London": "UK",
  "Europe/Paris": "Central European",
  "Asia/Tokyo": "Japan Standard Time",
};

function currentUtcOffset(tz: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const z = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+00:00";
  return z.replace("GMT", "UTC");
}

function tzLabel(tz: string) {
  return `${FRIENDLY[tz] ?? tz} (${currentUtcOffset(tz)})`;
}

function Profile() {
  const { userId, email: userEmail } = useUserInfo();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile, isLoading, isError, error } = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);
  const uploadAvatarMut = useUploadAvatar(userId);
  const deleteAvatarMut = useDeleteAvatar(userId);
  const deleteUserMut = useDeleteUser();

  const [currency, setCurrency] = useState("USD");
  const [numberFormat, setNumberFormat] = useState("1,234.56");

  type BudgetCycle = "weekly" | "monthly" | "quarterly" | "yearly";
  const [budgetCycle, setBudgetCycle] = useState<BudgetCycle>(
    (profile?.budget_reset_cycle as BudgetCycle) ?? "monthly"
  );

  const [resetDay, setResetDay] = useState<number>(1);
  const [timezone, setTimezone] = useState<string>(
    profile?.timezone ?? "America/Los_Angeles"
  );
  const [avatarBuster, setAvatarBuster] = useState<number>(Date.now());

  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!profile || hydrated) return;
    setBudgetCycle(
      (profile.budget_reset_cycle as
        | "weekly"
        | "monthly"
        | "quarterly"
        | "yearly") ?? "monthly"
    );
    setResetDay(profile.reset_day ?? 1);
    setTimezone(profile.timezone ?? "America/Los_Angeles");
    setHydrated(true);
  }, [profile, hydrated]);

  useEffect(() => {
    if (uploadAvatarMut.isSuccess || deleteAvatarMut.isSuccess) {
      setAvatarBuster(Date.now());
    }
  }, [uploadAvatarMut.isSuccess, deleteAvatarMut.isSuccess]);

  // 5) Derived display fields
  const fullName = profile?.full_name ?? "";
  const email = userEmail;
  const rawAvatar = profile?.avatar_url ?? null;
  const avatarUrl = rawAvatar ? `${rawAvatar}?v=${avatarBuster}` : "";

  // 6) Save handler
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      { budget_reset_cycle: budgetCycle, reset_day: resetDay, timezone },
      {
        onSuccess: () => {
          setSaveStatus({
            type: "success",
            message: "Profile updated successfully!",
          });
          // Clear the message after 3 seconds
          setTimeout(() => setSaveStatus({ type: null, message: "" }), 3000);
        },
        onError: (err) => {
          setSaveStatus({
            type: "error",
            message: err.message || "Failed to update profile!",
          });
          // Clear the message after 5 seconds for errors
          setTimeout(() => setSaveStatus({ type: null, message: "" }), 5000);
        },
      }
    );
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAvatarMut.mutate(file);
  };

  const handleDeleteAvatar = () => {
    deleteAvatarMut.mutate();
  };

  const handleDeleteUser = async () => {
    if (!userId) {
      return;
    }
    const confirmed = confirm("Are you sure you want to delete your account?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteUserMut.mutateAsync();
      await supabase.auth.signOut();
      qc.clear();
      navigate("/");
    } catch (e) {
      alert(getErrorMessage(e, "Failed to delete account"));
    }
  };

  if (isLoading) {
    return <div className="p-6 text-base-content">Loading profile…</div>;
  }

  if (isError) {
    return (
      <div className="p-6 text-red-500">
        {error?.message ?? "Failed to load profile"}
      </div>
    );
  }

  const LIST = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
  ] as const;

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <form onSubmit={handleSave} className="space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground mb-8">PROFILE</h1>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-border">
                <img
                  src={avatarUrl || blankProfile}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              {!!profile?.avatar_url && (
                <span
                  onClick={handleDeleteAvatar}
                  className="text-sm text-red-400 hover:text-red-500 hover:underline cursor-pointer mt-1"
                >
                  {deleteAvatarMut.isPending ? "Deleting…" : "Delete image"}
                </span>
              )}

              <label className="cursor-pointer text-sm text-white px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
                {uploadAvatarMut.isPending ? "Uploading…" : "Upload Image"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                Personal Information
              </h2>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground">
                    Full Name
                  </Label>
                  <Input
                    id="fullname"
                    type="text"
                    value={fullName}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                Regional Preferences
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-foreground">
                    Currency
                  </Label>
                  <Select value={currency} onValueChange={setCurrency} disabled>
                    <SelectTrigger className="bg-muted">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="AUD">
                        AUD - Australian Dollar
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numberFormat" className="text-foreground">
                    Number Format
                  </Label>
                  <Select
                    value={numberFormat}
                    onValueChange={setNumberFormat}
                    disabled
                  >
                    <SelectTrigger className="bg-muted">
                      <SelectValue placeholder="Select number format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1,234.56">1,234.56 (US)</SelectItem>
                      <SelectItem value="1.234,56">1.234,56 (EU)</SelectItem>
                      <SelectItem value="1 234,56">1 234,56 (FR)</SelectItem>
                      <SelectItem value="1'234.56">1'234.56 (CH)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-foreground">
                    Timezone
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="bg-muted">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {LIST.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tzLabel(tz)}
                        </SelectItem>
                      ))}
                      {timezone && !(LIST as readonly string[]).includes(timezone) && (
                        <SelectItem value={timezone}>
                          {tzLabel(timezone)}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
                Budget Settings
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="budgetCycle" className="text-foreground">
                    {" "}
                    Budget Reset Cycle
                  </Label>
                  <Select
                    value={budgetCycle}
                    onValueChange={(v) => setBudgetCycle(v as BudgetCycle)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resetDay" className="text-foreground">
                    Reset Day
                  </Label>
                  <Input
                    id="resetDay"
                    type="number"
                    value={resetDay}
                    onChange={(e) => setResetDay(Number(e.target.value))}
                    min={1}
                    max={31}
                    placeholder="Day of month (1-31)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 pt-6">
            <Button
              type="submit"
              className="w-full max-w-xs"
              size="lg"
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? "Saving…" : "Save Changes"}
            </Button>

            {/* Toast notification */}
            {saveStatus.type && (
              <div
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-all duration-300
                  ${
                    saveStatus.type === "success"
                      ? "bg-green-100 text-green-800 border border-green-200"
                      : "bg-red-100 text-red-800 border border-red-200"
                  }
                `}
              >
                {saveStatus.message}
              </div>
            )}

            <span
              className="text-lg text-red-400 hover:text-red-500 hover:underline cursor-pointer mt-1 flex justify-center pb-5"
              onClick={handleDeleteUser}
            >
              {deleteUserMut.isPending ? "Deleting account…" : "Delete User"}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Profile;
