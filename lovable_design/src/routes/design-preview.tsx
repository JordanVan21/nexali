import { createFileRoute, Link } from "@tanstack/react-router";

import { BrandMark } from "@/components/layout/BrandMark";

export const Route = createFileRoute("/design-preview")({
  head: () => ({
    meta: [
      { title: "Nexali — Design Preview Index" },
      {
        name: "description",
        content: "Internal index of every Nexali frontend screen for design review.",
      },
      { property: "og:title", content: "Nexali — Design Preview Index" },
      {
        property: "og:description",
        content: "Internal index of every Nexali frontend screen for design review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DesignPreviewPage,
});

type Entry = { to: string; label: string; note: string };

const groups: { title: string; entries: Entry[] }[] = [
  {
    title: "Public",
    entries: [
      { to: "/", label: "Landing", note: "Marketing home" },
      { to: "/signin", label: "Sign In", note: "Email + password" },
      { to: "/signup", label: "Sign Up", note: "Create account" },
      { to: "/forgot-password", label: "Forgot Password", note: "Request reset link" },
      { to: "/reset-password", label: "Reset Password", note: "Set a new password" },
      { to: "/email-verification", label: "Email Verification", note: "Waiting / verified states" },
    ],
  },
  {
    title: "Main App",
    entries: [
      { to: "/dashboard", label: "Dashboard", note: "Overview, charts, activity" },
      { to: "/transactions", label: "Transactions", note: "Table, filters, dialogs" },
      { to: "/budgets", label: "Budgets", note: "Envelope cards and progress" },
      { to: "/reports", label: "Reports", note: "Charts and breakdowns" },
      { to: "/aura", label: "Aura", note: "AI assistant conversation" },
    ],
  },
  {
    title: "Account",
    entries: [
      { to: "/profile", label: "Profile", note: "Personal details" },
      { to: "/account", label: "Account", note: "Security, plan, danger zone" },
      { to: "/settings", label: "Settings", note: "Preferences and formatting" },
      { to: "/notifications", label: "Notifications", note: "Activity feed" },
    ],
  },
];

function DesignPreviewPage() {
  return (
    <div className="min-h-dvh bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1000px]">
        <header className="mb-8 flex flex-col gap-3">
          <BrandMark />
          <div>
            <h1 className="font-display text-[28px] font-bold tracking-tight text-foreground sm:text-[36px]">
              Design Preview
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Internal index for reviewing every Nexali screen. Frontend only — no authentication,
              no backend. Remove this route when integrating into the real app.
            </p>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <section
              key={group.title}
              className="rounded-2xl border border-border bg-card p-4 sm:p-5"
            >
              <h2 className="font-display mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {group.title}
              </h2>
              <ul className="grid gap-1.5">
                {group.entries.map((entry) => (
                  <li key={entry.to}>
                    <Link
                      to={entry.to}
                      className="flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 transition-colors hover:bg-surface-high"
                    >
                      <span className="text-[15px] font-semibold text-foreground">
                        {entry.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.note} · <code className="font-mono">{entry.to}</code>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
