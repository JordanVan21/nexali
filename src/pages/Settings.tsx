import { useEffect, useState } from "react";
import { BellRing, Palette, SlidersHorizontal } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { StatusBanner } from "../components/states/StatusBanner";
import { ErrorState } from "../components/states/ErrorState";
import { Skeleton } from "../components/states/Skeleton";
import { useProfile, useUpdateProfile } from "../features/profiles/useProfile";
import { useUserInfo } from "../shared/useUserId";
import { getErrorMessage } from "../lib/utils";

/** Real, disabled-but-visible caption pattern already used for read-only Profile fields. */
const COMING_SOON_CAPTION = "Coming soon — not saved yet.";

/**
 * Real IANA identifiers (not Lovable's mock short codes) so values stay
 * compatible with the persisted `profiles.timezone` column, which is
 * constrained by the real `is_valid_tz` Postgres check.
 */
const TIMEZONE_OPTIONS = [
  { value: "America/Los_Angeles", label: "Pacific Time (America/Los_Angeles)" },
  { value: "America/Denver", label: "Mountain Time (America/Denver)" },
  { value: "America/Chicago", label: "Central Time (America/Chicago)" },
  { value: "America/New_York", label: "Eastern Time (America/New_York)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "Europe/London", label: "Greenwich Mean Time (Europe/London)" },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD ($) · US Dollar" },
  { value: "EUR", label: "EUR (€) · Euro" },
  { value: "GBP", label: "GBP (£) · British Pound" },
  { value: "CAD", label: "CAD ($) · Canadian Dollar" },
  { value: "AUD", label: "AUD ($) · Australian Dollar" },
  { value: "JPY", label: "JPY (¥) · Japanese Yen" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "mdy", label: "MM/DD/YYYY", preview: "10/24/2025" },
  { value: "dmy", label: "DD/MM/YYYY", preview: "24/10/2025" },
  { value: "ymd", label: "YYYY-MM-DD", preview: "2025-10-24" },
];

const NUMBER_FORMAT_OPTIONS = [
  { value: "standard", label: "1,234.56 (Standard comma separator)" },
  { value: "european", label: "1.234,56 (Period thousand separator)" },
  { value: "space", label: "1 234.56 (Thin space separator)" },
];

/** Real Lovable labels/descriptions -- no `notification_preferences` column exists yet, so every row stays disabled/unchecked. */
const NOTIFICATION_PREFERENCE_ROWS = [
  {
    id: "notify-approaching",
    label: "Budget approaching limit",
    description: "Get notified when spending nears a category budget.",
  },
  {
    id: "notify-exceeded",
    label: "Budget exceeded",
    description: "Get notified when spending passes a budget ceiling.",
  },
  {
    id: "notify-summary",
    label: "Monthly financial summary",
    description: "Receive a summary when your monthly period ends.",
  },
  {
    id: "notify-security",
    label: "Account and security notifications",
    description: "Important sign-in and security updates.",
  },
];

function SettingsSkeleton() {
  return (
    <PageContainer>
      <div aria-hidden="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
        <div className="mx-auto mt-6 max-w-[1200px] space-y-6 md:mt-8 md:space-y-8">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading settings…</span>
    </PageContainer>
  );
}

/**
 * Application preferences. Timezone is the only currently persisted, real
 * editable field (profiles.timezone, via the same useUpdateProfile mutation
 * Profile uses) -- Profile keeps showing it read-only per the approved split.
 * Currency, date format and number format have no backing column yet, so
 * their controls are visually present (matching the real Lovable settings
 * route) but disabled, never claiming to save. Budget reset cycle/day stay
 * on Profile (its existing real editable location) rather than being
 * duplicated here. Notification preferences (Part 11) show the real Lovable
 * rows but stay disabled -- no `notification_preferences` table/column
 * exists yet. The Aura-preference section is deferred to a later phase
 * rather than faked.
 */
export default function Settings() {
  const { userId } = useUserInfo();
  const { data: profile, isLoading, isError, error, refetch } = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);

  const [timezone, setTimezone] = useState<string | null>(null);
  const [savedTimezone, setSavedTimezone] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error" | null; message: string }>({
    type: null,
    message: "",
  });

  useEffect(() => {
    if (!profile || savedTimezone) return;
    setTimezone(profile.timezone);
    setSavedTimezone(profile.timezone);
  }, [profile, savedTimezone]);

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Couldn't load your settings"
          message={getErrorMessage(error, "Please check your connection and try again.")}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  if (timezone === null || savedTimezone === null) {
    return <SettingsSkeleton />;
  }

  const timezoneOptions = TIMEZONE_OPTIONS.some((o) => o.value === savedTimezone)
    ? TIMEZONE_OPTIONS
    : [{ value: savedTimezone, label: savedTimezone }, ...TIMEZONE_OPTIONS];

  const isDirty = timezone !== savedTimezone;

  const handleSave = () => {
    if (updateProfile.isPending) return;
    updateProfile.mutate(
      { timezone },
      {
        onSuccess: () => {
          setSavedTimezone(timezone);
          setSaveStatus({ type: "success", message: "Settings saved." });
          setTimeout(() => setSaveStatus({ type: null, message: "" }), 3000);
        },
        onError: (err) => {
          setSaveStatus({ type: "error", message: getErrorMessage(err, "Failed to save settings.") });
          setTimeout(() => setSaveStatus({ type: null, message: "" }), 5000);
        },
      }
    );
  };

  const handleDiscard = () => setTimezone(savedTimezone);

  return (
    <PageContainer>
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[36px] lg:text-[44px] xl:text-[48px]">
          Settings
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground sm:text-base lg:text-lg xl:text-xl">
          Configure currency, timezone, formats and appearance across Nexali.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-[1200px] md:mt-8">
        {saveStatus.type && (
          <StatusBanner variant={saveStatus.type} className="mb-6">
            {saveStatus.message}
          </StatusBanner>
        )}

        <div className="space-y-6 md:space-y-8">
          <section>
            <div className="mb-3 flex items-center gap-2 xl:mb-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="font-display text-lg font-semibold text-foreground xl:text-xl">General</h2>
            </div>
            <p className="-mt-2 mb-3 text-sm text-muted-foreground xl:-mt-3">
              Currency, timezone and regional number formats.
            </p>
            <div className="nexali-panel grid gap-5 rounded-xl p-5 sm:grid-cols-2 md:p-6 xl:p-7">
              <div className="space-y-2">
                <Label htmlFor="settings-currency" className="md:text-[15px]">
                  Default currency
                </Label>
                <Select value="USD" disabled>
                  <SelectTrigger id="settings-currency" className="h-11 text-base md:text-base xl:h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm italic text-muted-foreground">{COMING_SOON_CAPTION}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-timezone" className="md:text-[15px]">
                  Timezone
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="settings-timezone" className="h-11 text-base md:text-base xl:h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">Used when grouping activity by date across Nexali.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-date-format" className="md:text-[15px]">
                  Date format
                </Label>
                <Select value="mdy" disabled>
                  <SelectTrigger id="settings-date-format" className="h-11 text-base md:text-base xl:h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMAT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Preview: <span className="numeric text-foreground">10/24/2025</span>
                </p>
                <p className="text-sm italic text-muted-foreground">{COMING_SOON_CAPTION}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-number-format" className="md:text-[15px]">
                  Number format
                </Label>
                <Select value="standard" disabled>
                  <SelectTrigger id="settings-number-format" className="h-11 text-base md:text-base xl:h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NUMBER_FORMAT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm italic text-muted-foreground">{COMING_SOON_CAPTION}</p>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 xl:mb-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Palette className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="font-display text-lg font-semibold text-foreground xl:text-xl">Appearance</h2>
            </div>
            <p className="-mt-2 mb-3 text-sm text-muted-foreground xl:-mt-3">
              Display comfort and motion preferences.
            </p>
            <div className="nexali-panel divide-y divide-border rounded-xl p-5 md:p-6 xl:p-7">
              <div className="grid grid-cols-1 gap-2 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                <div>
                  <span className="block text-sm font-medium text-foreground md:text-[15px]">Color palette</span>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Nexali currently operates on its signature dark theme.
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-surface-lowest px-3 py-1.5 text-xs font-medium text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  Nexali Obsidian Dark
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                <div>
                  <span className="block text-sm font-medium text-foreground md:text-[15px]">Reduce animations</span>
                  <p className="mt-0.5 text-sm text-muted-foreground">Minimize non-essential interface motion.</p>
                </div>
                <span className="text-sm italic text-muted-foreground">{COMING_SOON_CAPTION}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 py-4 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                <div>
                  <span className="block text-sm font-medium text-foreground md:text-[15px]">
                    Show values on charts
                  </span>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Display numeric amounts alongside bars and trendlines.
                  </p>
                </div>
                <span className="text-sm italic text-muted-foreground">{COMING_SOON_CAPTION}</span>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 xl:mb-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <BellRing className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="font-display text-lg font-semibold text-foreground xl:text-xl">Notifications</h2>
            </div>
            <p className="-mt-2 mb-3 text-sm text-muted-foreground xl:-mt-3">
              Choose which finance and budget updates you receive.
            </p>
            <div className="nexali-panel divide-y divide-border rounded-xl p-5 md:p-6 xl:p-7">
              {NOTIFICATION_PREFERENCE_ROWS.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
                >
                  <div>
                    <Label htmlFor={row.id} className="md:text-[15px]">
                      {row.label}
                    </Label>
                    <p className="mt-0.5 text-sm text-muted-foreground">{row.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm italic text-muted-foreground">{COMING_SOON_CAPTION}</span>
                    <Switch id={row.id} checked={false} disabled aria-label={row.label} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDiscard}
              disabled={!isDirty || updateProfile.isPending}
            >
              Discard changes
            </Button>
            <Button
              type="button"
              variant="hero"
              size="control"
              onClick={handleSave}
              disabled={!isDirty || updateProfile.isPending}
            >
              {updateProfile.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
