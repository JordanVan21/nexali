import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Camera, Shield, Trash2, Upload } from "lucide-react";
import blankProfile from "../assets/blank_profile_pic.jpg";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { buttonVariants } from "../components/ui/button-variants";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { StatusBanner } from "../components/states/StatusBanner";
import { ErrorState } from "../components/states/ErrorState";
import { Skeleton } from "../components/states/Skeleton";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useProfile, useUpdateProfile } from "../features/profiles/useProfile";
import { useUploadAvatar, useDeleteAvatar } from "../features/profiles/useAvatar";
import { useUser } from "../features/user/userUser";
import { useUserInfo } from "../shared/useUserId";
import { getErrorMessage, cn } from "../lib/utils";

type BudgetCycle = "weekly" | "monthly" | "quarterly" | "yearly";

type FormState = {
  fullName: string;
  budgetCycle: BudgetCycle;
  resetDay: number;
};

const FULL_NAME_MAX = 120;

/**
 * Nexali's current application-wide fixed currency. Not a persisted
 * `profiles` column -- there is no real per-user currency preference yet, so
 * this is a static UI label, not a value loaded from the database. Profile
 * displays it as read-only info; it is not part of the Save payload.
 */
const FIXED_CURRENCY_LABEL = "USD ($)";

function ProfileSkeleton() {
  return (
    <PageContainer>
      <div aria-hidden="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
        <div className="mx-auto mt-6 max-w-[1200px] space-y-6 md:mt-8 md:space-y-8 xl:mt-10">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-28 w-28 rounded-full md:h-32 md:w-32 xl:h-36 xl:w-36" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-12 md:gap-6 xl:gap-8">
            <div className="md:col-span-5">
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
            <div className="md:col-span-7">
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <div className="md:col-span-12">
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Loading profile…</span>
    </PageContainer>
  );
}

/**
 * Full name is a real `profiles.full_name` column already displayed
 * everywhere else in the app; this Part connects it to `useUpdateProfile`'s
 * mutation for the first time so it can genuinely be edited (previously the
 * field rendered but was hard-disabled with no save path at all).
 */
export default function Profile() {
  const { userId, email } = useUserInfo();
  const { data: profile, isLoading, isError, error, refetch } = useProfile(userId);
  const { data: authUser } = useUser();
  const updateProfile = useUpdateProfile(userId);
  const uploadAvatarMut = useUploadAvatar(userId);
  const deleteAvatarMut = useDeleteAvatar(userId);

  const [avatarBuster, setAvatarBuster] = useState(() => Date.now());
  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState<FormState | null>(null);
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);

  useEffect(() => {
    if (!profile || saved) return;
    const baseline: FormState = {
      fullName: profile.full_name ?? "",
      budgetCycle: (profile.budget_reset_cycle as BudgetCycle) ?? "monthly",
      resetDay: profile.reset_day ?? 1,
    };
    setForm(baseline);
    setSaved(baseline);
  }, [profile, saved]);

  useEffect(() => {
    if (uploadAvatarMut.isSuccess || deleteAvatarMut.isSuccess) setAvatarBuster(Date.now());
  }, [uploadAvatarMut.isSuccess, deleteAvatarMut.isSuccess]);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Couldn't load your profile"
          message={getErrorMessage(error, "Please check your connection and try again.")}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  if (!form || !saved) {
    return <ProfileSkeleton />;
  }

  const rawAvatar = profile?.avatar_url ?? null;
  const avatarUrl = rawAvatar ? `${rawAvatar}?v=${avatarBuster}` : "";
  const memberSince =
    authUser?.created_at &&
    new Date(authUser.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (updateProfile.isPending) return;
    const trimmedName = form.fullName.trim();
    if (!trimmedName) {
      setFullNameError("Full name is required.");
      return;
    }
    if (trimmedName.length > FULL_NAME_MAX) {
      setFullNameError(`Full name must be ${FULL_NAME_MAX} characters or fewer.`);
      return;
    }
    setFullNameError(null);

    updateProfile.mutate(
      {
        full_name: trimmedName,
        budget_reset_cycle: form.budgetCycle,
        reset_day: form.resetDay,
      },
      {
        onSuccess: () => {
          setSaved({ ...form, fullName: trimmedName });
          setForm({ ...form, fullName: trimmedName });
          setSaveStatus({ type: "success", message: "Profile updated successfully." });
          setTimeout(() => setSaveStatus({ type: null, message: "" }), 3000);
        },
        onError: (err) => {
          setSaveStatus({ type: "error", message: getErrorMessage(err, "Failed to update profile.") });
          setTimeout(() => setSaveStatus({ type: null, message: "" }), 5000);
        },
      }
    );
  };

  const handleDiscard = () => {
    setForm(saved);
    setFullNameError(null);
  };

  const handleAvatarUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadAvatarMut.mutate(file);
  };

  const confirmRemove = () => {
    deleteAvatarMut.mutate(undefined, { onSuccess: () => setConfirmRemoveAvatar(false) });
  };

  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl xl:text-[32px] 2xl:text-[34px]">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">Your identity and preferences across Nexali.</p>
      </div>

      <div className="mx-auto mt-6 max-w-[1200px] md:mt-8 xl:mt-10">
        {saveStatus.type && (
          <StatusBanner variant={saveStatus.type} className="mb-6">
            {saveStatus.message}
          </StatusBanner>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-6 md:space-y-8">
          <div className="flex flex-col items-center gap-4 pb-4 text-center md:gap-5 md:pb-6">
            <div className="relative">
              <div className="h-28 w-28 overflow-hidden rounded-full border-2 border-primary/60 ring-2 ring-border/40 md:h-32 md:w-32 xl:h-36 xl:w-36">
                <img src={avatarUrl || blankProfile} alt="" className="h-full w-full object-cover" />
              </div>
              <label
                aria-label="Change profile photo"
                className="absolute -bottom-1 -right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95 md:h-10 md:w-10 xl:h-11 xl:w-11"
              >
                <Camera className="h-4 w-4 xl:h-5 xl:w-5" aria-hidden="true" />
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleAvatarUpload}
                  disabled={uploadAvatarMut.isPending}
                />
              </label>
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground xl:text-[28px]">
                {form.fullName || email || "Your Profile"}
              </h2>
              {memberSince && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-accent/20 px-3 py-1 text-xs text-muted-foreground md:px-4 md:py-1.5 md:text-sm">
                  <Shield className="h-3.5 w-3.5 text-primary md:h-4 md:w-4" aria-hidden="true" />
                  Member since {memberSince}
                </div>
              )}
            </div>
            {uploadAvatarMut.isPending && <p className="text-xs text-muted-foreground md:text-sm">Uploading photo…</p>}
            {uploadAvatarMut.isError && (
              <p role="alert" className="text-xs text-destructive md:text-sm">
                {getErrorMessage(uploadAvatarMut.error, "Failed to upload photo.")}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-12 md:gap-6 xl:gap-8">
            <section className="md:col-span-5">
              <h2 className="mb-3 font-display text-lg font-semibold text-foreground xl:mb-4 xl:text-xl">Avatar</h2>
              <div className="nexali-panel space-y-4 rounded-xl p-5 md:p-6 xl:p-7">
                <p className="text-sm text-muted-foreground md:text-base">A square image works best.</p>
                <label
                  className={cn(buttonVariants({ variant: "hero", size: "control" }), "w-full cursor-pointer")}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {uploadAvatarMut.isPending ? "Uploading…" : "Upload new photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleAvatarUpload}
                    disabled={uploadAvatarMut.isPending}
                  />
                </label>
                {rawAvatar && (
                  <Button
                    type="button"
                    variant="surface"
                    size="control"
                    className="w-full"
                    onClick={() => setConfirmRemoveAvatar(true)}
                    disabled={deleteAvatarMut.isPending}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove current
                  </Button>
                )}
              </div>
            </section>

            <section className="md:col-span-7">
              <h2 className="mb-3 font-display text-lg font-semibold text-foreground xl:mb-4 xl:text-xl">
                Personal identity
              </h2>
              <div className="nexali-panel space-y-5 rounded-xl p-5 md:p-6 xl:p-7">
                <div className="space-y-2">
                  <Label htmlFor="profile-name" className="md:text-[15px]">
                    Full name
                  </Label>
                  <Input
                    id="profile-name"
                    value={form.fullName}
                    maxLength={FULL_NAME_MAX}
                    onChange={(e) => {
                      setForm({ ...form, fullName: e.target.value });
                      setFullNameError(null);
                    }}
                    aria-invalid={fullNameError ? true : undefined}
                    aria-describedby={fullNameError ? "profile-name-error" : undefined}
                    className="h-11 text-base md:text-base xl:h-12"
                  />
                  {fullNameError && (
                    <p id="profile-name-error" className="text-sm text-destructive">
                      {fullNameError}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email" className="md:text-[15px]">
                    Email address
                  </Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email ?? ""}
                    readOnly
                    disabled
                    className="h-11 cursor-not-allowed bg-muted text-base md:text-base xl:h-12"
                  />
                  <p className="text-sm italic text-muted-foreground">Contact support to change your sign-in email.</p>
                </div>
              </div>
            </section>

            <section className="md:col-span-12">
              <h2 className="mb-3 font-display text-lg font-semibold text-foreground xl:mb-4 xl:text-xl">Preferences</h2>
              <p className="-mt-2 mb-3 text-sm text-muted-foreground xl:-mt-3">Defaults used across Nexali.</p>
              <div className="nexali-panel divide-y divide-border rounded-xl p-5 md:p-6 xl:p-7">
                <div className="grid grid-cols-1 gap-2 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 xl:py-5">
                  <div>
                    <span className="block text-sm font-medium text-foreground md:text-[15px]">Preferred currency</span>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Used throughout budgets, transactions and reports.
                    </p>
                  </div>
                  <span className="numeric text-sm text-foreground md:text-base">{FIXED_CURRENCY_LABEL}</span>
                </div>

                <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 xl:py-5">
                  <div>
                    <span className="block text-sm font-medium text-foreground md:text-[15px]">Timezone</span>
                    <p className="mt-0.5 text-sm text-muted-foreground">Used when grouping activity by date.</p>
                  </div>
                  <span className="text-sm text-foreground md:text-base">
                    {profile?.timezone ?? "Not set"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 xl:py-5">
                  <div>
                    <Label htmlFor="profile-budget-cycle" className="md:text-[15px]">
                      Budget reset cycle
                    </Label>
                    <p className="mt-0.5 text-sm text-muted-foreground">How often your budgets reset.</p>
                  </div>
                  <Select
                    value={form.budgetCycle}
                    onValueChange={(v) => setForm({ ...form, budgetCycle: v as BudgetCycle })}
                  >
                    <SelectTrigger id="profile-budget-cycle" className="h-11 text-base sm:w-64 md:text-base xl:h-12 xl:w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-2 py-4 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 xl:py-5">
                  <div>
                    <Label htmlFor="profile-reset-day" className="md:text-[15px]">
                      Reset day
                    </Label>
                    <p className="mt-0.5 text-sm text-muted-foreground">Day of month your budgets reset (1-31).</p>
                  </div>
                  <Input
                    id="profile-reset-day"
                    type="number"
                    min={1}
                    max={31}
                    value={form.resetDay}
                    onChange={(e) => setForm({ ...form, resetDay: Number(e.target.value) })}
                    className="h-11 text-base sm:w-28 md:text-base xl:h-12"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={handleDiscard} disabled={!isDirty || updateProfile.isPending}>
              Discard changes
            </Button>
            <Button type="submit" variant="hero" size="control" disabled={!isDirty || updateProfile.isPending}>
              {updateProfile.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmRemoveAvatar}
        onOpenChange={setConfirmRemoveAvatar}
        title="Remove profile photo?"
        description="Your profile photo will be removed. You can upload a new one anytime."
        confirmLabel="Remove"
        pendingLabel="Removing…"
        onConfirm={confirmRemove}
        isPending={deleteAvatarMut.isPending}
        errorMessage={deleteAvatarMut.isError ? getErrorMessage(deleteAvatarMut.error, "Failed to remove photo.") : null}
      />
    </PageContainer>
  );
}
