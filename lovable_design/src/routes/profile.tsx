import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, IdCard, Shield, Trash2, Upload } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { ProfileAvatar } from "@/components/layout/ProfileAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBanner } from "@/components/common/StatusBanner";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { mockUser } from "@/mock/profile";

const title = "Profile — Nexali";
const description = "Manage your identity, contact details and financial bio for Aura.";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const BIO_LIMIT = 240;

type FormState = {
  name: string;
  phone: string;
  location: string;
  bio: string;
};

const initialForm: FormState = {
  name: mockUser.name,
  phone: mockUser.phone,
  location: mockUser.location,
  bio: "Focused on building a six-month emergency fund and trimming discretionary spending.",
};

function ProfilePage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saved, setSaved] = useState<FormState>(initialForm);
  const [showSuccess, setShowSuccess] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  const handleSave = () => {
    setSaved(form);
    setShowSuccess(true);
  };

  const handleDiscard = () => {
    setForm(saved);
  };

  return (
    <AppShell activeKey="profile" userName={mockUser.name} userEmail={mockUser.email}>
      <PageContainer className="max-w-[900px]">
        <PageHeader title="Profile" description="How you appear across Nexali and to Aura." />

        {showSuccess && (
          <StatusBanner
            className="mb-6"
            title="Profile updated"
            description="Your changes have been saved."
            onDismiss={() => setShowSuccess(false)}
          />
        )}

        <div className="flex flex-col items-center gap-4 pb-8 text-center">
          <div className="relative">
            <ProfileAvatar name={saved.name} size="md" className="h-28 w-28 border-2 border-primary/60 text-2xl" />
            <button
              type="button"
              aria-label="Change profile photo"
              className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">{saved.name}</h2>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-high px-3 py-1 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Member since {mockUser.memberSince}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-12 md:gap-6">
          <div className="md:col-span-5">
            <SettingsSection title="Avatar" description="Recommended size is 400×400px." icon={IdCard}>
              <div className="flex flex-col gap-2">
                <Button variant="brand" size="control">
                  <Upload className="h-4 w-4" />
                  Upload new photo
                </Button>
                <Button variant="surface" size="control">
                  <Trash2 className="h-4 w-4" />
                  Remove current
                </Button>
              </div>
            </SettingsSection>
          </div>

          <div className="md:col-span-7">
            <SettingsSection title="Personal identity" description="Keep your details current.">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name">Full name</Label>
                  <Input
                    id="profile-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-email" className="flex items-center gap-1.5">
                    Email address
                  </Label>
                  <Input id="profile-email" type="email" value={mockUser.email} readOnly disabled className="cursor-not-allowed" />
                  <p className="text-xs italic text-muted-foreground">
                    Contact support to change your primary email.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-phone">Phone number</Label>
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-location">Location</Label>
                  <Input
                    id="profile-location"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </div>
              </div>
            </SettingsSection>
          </div>

          <div className="md:col-span-12">
            <SettingsSection
              title="Financial bio"
              description="Briefly describe your financial goals for Aura."
              actions={
                <span className="numeric text-xs text-muted-foreground">
                  {form.bio.length}/{BIO_LIMIT}
                </span>
              }
            >
              <Textarea
                rows={4}
                maxLength={BIO_LIMIT}
                placeholder="E.g., Focused on long-term wealth building and reducing recurring subscriptions..."
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </SettingsSection>
          </div>

          <div className="md:col-span-12">
            <SettingsSection title="Preferences" description="Defaults used across Nexali.">
              <div className="divide-y divide-border">
                <SettingsRow
                  className="py-3 first:pt-0"
                  label="Preferred currency"
                  description="Used throughout budgets, transactions and reports."
                  control={<span className="numeric text-sm text-foreground">{mockUser.currency}</span>}
                />
                <SettingsRow
                  className="py-3 last:pb-0"
                  label="Timezone"
                  description="Used when grouping activity by date."
                  control={<span className="text-sm text-foreground">{mockUser.timezone}</span>}
                />
              </div>
            </SettingsSection>
          </div>
        </div>

        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] mt-6 flex flex-col-reverse gap-2 border-t border-border bg-background/80 py-4 backdrop-blur md:static md:flex-row md:justify-end md:gap-3 md:bg-transparent md:backdrop-blur-none">
          <Button variant="ghost" onClick={handleDiscard} disabled={!isDirty} className="md:w-auto">
            Discard changes
          </Button>
          <Button variant="brand" size="control" onClick={handleSave} disabled={!isDirty} className="md:w-auto">
            Save changes
          </Button>
        </div>
      </PageContainer>
    </AppShell>
  );
}
