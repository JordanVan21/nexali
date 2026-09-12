import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AtSign,
  Download,
  Fingerprint,
  Laptop,
  Link2,
  LogOut,
  Shield,
  ShieldAlert,
  Smartphone,
  Tablet,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { mockUser } from "@/mock/profile";
import { mockConnectedAccounts, mockSessions, type Session } from "@/mock/settings";
import { cn } from "@/lib/utils";

const title = "Account — Nexali";
const description = "Manage security, sessions, connected accounts and data for your Nexali account.";

export const Route = createFileRoute("/account")({
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
  component: AccountPage,
});

const sessionIcons: Record<Session["icon"], typeof Laptop> = {
  laptop: Laptop,
  phone: Smartphone,
  tablet: Tablet,
};

function AccountPage() {
  const [sessions, setSessions] = useState(mockSessions);
  const [accounts, setAccounts] = useState(mockConnectedAccounts);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  const signOutSession = (id: string) => setSessions((list) => list.filter((s) => s.id !== id));
  const toggleAccount = (id: string) =>
    setAccounts((list) => list.map((a) => (a.id === id ? { ...a, connected: !a.connected } : a)));

  return (
    <AppShell activeKey="account" userName={mockUser.name} userEmail={mockUser.email}>
      <PageContainer>
        <PageHeader
          title="Account Security"
          description="Manage your sign-in methods, active sessions and data privacy settings."
        />

        <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
          <div className="space-y-4 lg:col-span-8 lg:space-y-6">
            <SettingsSection title="Sign-in information" icon={AtSign}>
              <SettingsRow
                label={<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current email</span>}
                description={mockUser.email}
                control={
                  <Button variant="surface" size="sm">
                    Change email
                  </Button>
                }
              />
            </SettingsSection>

            <SettingsSection title="Password & security" icon={Shield}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-outline-variant bg-surface-low p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Account password
                    </p>
                    <Badge className="bg-success/15 text-success">Strong</Badge>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Last updated 45 days ago. We recommend rotating every 90 days.
                  </p>
                  <Button variant="brand" size="control" className="w-full">
                    Update password
                  </Button>
                </div>
                <div className="rounded-lg border border-outline-variant bg-surface-low p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Two-factor auth
                    </p>
                    <Badge className={twoFactorEnabled ? "bg-success/15 text-success" : "bg-surface-high text-muted-foreground"}>
                      {twoFactorEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Authenticator app is active to protect your account.
                  </p>
                  <Button
                    variant="surface"
                    size="control"
                    className="w-full"
                    onClick={() => setTwoFactorEnabled((v) => !v)}
                  >
                    <Fingerprint className="h-4 w-4" />
                    Manage 2FA
                  </Button>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Active sessions"
              icon={Laptop}
              actions={
                <button
                  type="button"
                  onClick={() => setSessions([])}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Sign out of all
                </button>
              }
            >
              <ul className="space-y-3">
                {sessions.map((session) => {
                  const Icon = sessionIcons[session.icon];
                  return (
                    <li
                      key={session.id}
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-3",
                        session.current ? "border-primary/40 bg-primary/5" : "border-outline-variant",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface-high text-foreground">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {session.device}
                            {session.current && <span className="ml-2 text-xs font-medium text-primary">Current device</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {session.location} • {session.detail}
                          </p>
                        </div>
                      </div>
                      {!session.current && (
                        <button
                          type="button"
                          aria-label={`Sign out ${session.device}`}
                          onClick={() => signOutSession(session.id)}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <LogOut className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
                {sessions.length === 0 && (
                  <li className="rounded-lg border border-dashed border-outline-variant p-4 text-center text-sm text-muted-foreground">
                    No other active sessions.
                  </li>
                )}
              </ul>
            </SettingsSection>

            <SettingsSection title="Connected accounts" icon={Link2}>
              <ul className="divide-y divide-border">
                {accounts.map((account) => (
                  <li key={account.id} className="py-3 first:pt-0 last:pb-0">
                    <SettingsRow
                      label={account.name}
                      description={account.detail}
                      htmlFor={`account-${account.id}`}
                      control={
                        <Switch
                          id={`account-${account.id}`}
                          checked={account.connected}
                          onCheckedChange={() => toggleAccount(account.id)}
                          aria-label={`Toggle ${account.name} connection`}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
            </SettingsSection>
          </div>

          <div className="space-y-4 lg:col-span-4 lg:space-y-6">
            <SettingsSection title="Data & privacy" icon={ShieldAlert}>
              <div className="space-y-3">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface-high"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-high text-foreground">
                    <Download className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">Export your data</span>
                    <span className="block text-xs text-muted-foreground">Download a copy of your financial records.</span>
                  </span>
                </button>
              </div>
            </SettingsSection>

            <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden="true" />
                <h2 className="font-display text-lg font-semibold text-destructive">Danger zone</h2>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                Deleting your account will permanently erase all financial records, Aura learnings and
                linked accounts. This action is irreversible.
              </p>
              <Button
                variant="destructive"
                size="control"
                className="w-full"
                onClick={() => setDeleteOpen(true)}
              >
                Delete my account
              </Button>
            </section>
          </div>
        </div>
      </PageContainer>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </AppShell>
  );
}
