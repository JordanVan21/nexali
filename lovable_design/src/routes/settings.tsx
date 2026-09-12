import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, Info, Palette, PiggyBank, SlidersHorizontal, BellRing } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatusBanner } from "@/components/common/StatusBanner";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { cn } from "@/lib/utils";
import {
  mockBudgetCycleOptions,
  mockCurrencyOptions,
  mockDateFormatOptions,
  mockNumberFormatOptions,
  mockResetDayOptions,
  mockResponseDetailOptions,
  mockSettings,
  mockTimezoneOptions,
  type MockSettings,
} from "@/mock/settings";
import { mockUser } from "@/mock/profile";

const title = "Settings — Nexali";
const description = "Configure regional formats, budgets, appearance, notifications and Aura preferences.";

export const Route = createFileRoute("/settings")({
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
  component: SettingsPage,
});

const navItems = [
  { key: "general", label: "General", icon: SlidersHorizontal },
  { key: "budgets", label: "Budget Preferences", icon: PiggyBank },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "notifications", label: "Notifications", icon: BellRing },
  { key: "assistant", label: "Assistant", icon: Bot },
];

function SettingsPage() {
  const [settings, setSettings] = useState<MockSettings>(mockSettings);
  const [saved, setSaved] = useState<MockSettings>(mockSettings);
  const [showSuccess, setShowSuccess] = useState(false);
  const [active, setActive] = useState("general");

  const isDirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const set = <K extends keyof MockSettings>(key: K, value: MockSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const activeDateFormat = mockDateFormatOptions.find((o) => o.value === settings.dateFormat);

  const handleSave = () => {
    setSaved(settings);
    setShowSuccess(true);
  };
  const handleReset = () => setSettings(saved);

  return (
    <AppShell activeKey="settings" userName={mockUser.name} userEmail={mockUser.email}>
      <PageContainer>
        <PageHeader
          title="Settings"
          description="These preferences adapt how money, dates and alerts appear across Nexali."
          actions={
            <>
              <Button variant="ghost" onClick={handleReset} disabled={!isDirty}>
                Reset changes
              </Button>
              <Button variant="brand" size="control" onClick={handleSave} disabled={!isDirty}>
                Save changes
              </Button>
            </>
          }
        />

        {showSuccess && (
          <StatusBanner
            className="mb-6"
            title="Settings saved"
            description="Your preferences have been updated."
            onDismiss={() => setShowSuccess(false)}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          <aside className="min-w-0 lg:col-span-3">
            <nav
              aria-label="Settings sections"
              className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-low p-1 scroll-slim lg:flex-col lg:overflow-visible"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <a
                    key={item.key}
                    href={`#${item.key}`}
                    onClick={() => setActive(item.key)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-surface-high hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </a>
                );
              })}
            </nav>
            <div className="mt-4 hidden rounded-xl border border-border bg-surface-low/50 p-4 text-xs leading-relaxed text-muted-foreground lg:block">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <Info className="h-4 w-4 text-primary" aria-hidden="true" />
                Personal settings
              </div>
              These preferences adapt how money, dates and alerts are shown across your dashboard.
            </div>
          </aside>

          <div className="space-y-8 lg:col-span-9">
            <SettingsSection
              id="general"
              title="General"
              description="Configure currency, timezone and regional number formats."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="currency-select">Default currency</Label>
                  <Select value={settings.currency} onValueChange={(v) => set("currency", v)}>
                    <SelectTrigger id="currency-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mockCurrencyOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="timezone-select">Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(v) => set("timezone", v)}>
                    <SelectTrigger id="timezone-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mockTimezoneOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="date-format-select">Date format</Label>
                  <Select value={settings.dateFormat} onValueChange={(v) => set("dateFormat", v)}>
                    <SelectTrigger id="date-format-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mockDateFormatOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeDateFormat && (
                    <p className="text-xs text-muted-foreground">
                      Preview: <span className="numeric text-foreground">{activeDateFormat.preview}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="number-format-select">Number format</Label>
                  <Select value={settings.numberFormat} onValueChange={(v) => set("numberFormat", v)}>
                    <SelectTrigger id="number-format-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mockNumberFormatOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="budgets"
              title="Budget Preferences"
              description="Adjust how your recurring budget cycles refresh."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cycle-select">Budget reset cycle</Label>
                  <Select value={settings.budgetCycle} onValueChange={(v) => set("budgetCycle", v)}>
                    <SelectTrigger id="cycle-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mockBudgetCycleOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-day-select">Budget reset day</Label>
                  <Select value={settings.resetDay} onValueChange={(v) => set("resetDay", v)}>
                    <SelectTrigger id="reset-day-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mockResetDayOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="appearance"
              title="Appearance"
              description="Manage display comfort and motion preferences."
              divided
            >
              <SettingsRow
                label="Color palette"
                description="Nexali currently operates on its signature dark theme."
                control={
                  <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-low px-3 py-1.5 text-xs font-medium text-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    Nexali Obsidian Dark
                  </span>
                }
              />
              <SettingsRow
                label="Reduce animations"
                description="Minimize non-essential interface motion."
                htmlFor="reduce-animations"
                control={
                  <Switch
                    id="reduce-animations"
                    checked={settings.reduceAnimations}
                    onCheckedChange={(v) => set("reduceAnimations", v)}
                  />
                }
              />
              <SettingsRow
                label="Show values on charts"
                description="Display numeric amounts alongside bars and trendlines."
                htmlFor="show-chart-values"
                control={
                  <Switch
                    id="show-chart-values"
                    checked={settings.showChartValues}
                    onCheckedChange={(v) => set("showChartValues", v)}
                  />
                }
              />
            </SettingsSection>

            <SettingsSection
              id="notifications"
              title="Notifications"
              description="Choose which finance and budget updates you receive."
              divided
            >
              <SettingsRow
                label="Budget approaching limit"
                description="Get notified when spending nears a category budget."
                htmlFor="notify-approaching"
                control={
                  <Switch
                    id="notify-approaching"
                    checked={settings.notifyBudgetApproaching}
                    onCheckedChange={(v) => set("notifyBudgetApproaching", v)}
                  />
                }
              />
              <SettingsRow
                label="Budget exceeded"
                description="Get notified when spending passes a budget ceiling."
                htmlFor="notify-exceeded"
                control={
                  <Switch
                    id="notify-exceeded"
                    checked={settings.notifyBudgetExceeded}
                    onCheckedChange={(v) => set("notifyBudgetExceeded", v)}
                  />
                }
              />
              <SettingsRow
                label="Monthly financial summary"
                description="Receive a summary when your monthly period ends."
                htmlFor="notify-summary"
                control={
                  <Switch
                    id="notify-summary"
                    checked={settings.notifyMonthlySummary}
                    onCheckedChange={(v) => set("notifyMonthlySummary", v)}
                  />
                }
              />
              <SettingsRow
                label="Account and security notifications"
                description="Important sign-in and security updates."
                htmlFor="notify-security"
                control={
                  <Switch
                    id="notify-security"
                    checked={settings.notifyAccountActivity}
                    onCheckedChange={(v) => set("notifyAccountActivity", v)}
                  />
                }
              />
            </SettingsSection>

            <SettingsSection
              id="assistant"
              title="Assistant"
              description="Tune how the read-only Aura assistant provides guidance."
            >
              <div className="space-y-5 divide-y divide-border [&>*]:pt-5 [&>*:first-child]:pt-0">
                <SettingsRow
                  label="Use my financial data when answering questions"
                  description="Allow Aura to use transactions, budgets and reports for personalized answers."
                  htmlFor="assistant-use-data"
                  control={
                    <Switch
                      id="assistant-use-data"
                      checked={settings.assistantUseFinancialData}
                      onCheckedChange={(v) => set("assistantUseFinancialData", v)}
                    />
                  }
                />

                <div>
                  <Label className="mb-2 block">Response detail</Label>
                  <RadioGroup
                    value={settings.assistantResponseDetail}
                    onValueChange={(v) => set("assistantResponseDetail", v as MockSettings["assistantResponseDetail"])}
                    className="grid gap-3 sm:grid-cols-3"
                  >
                    {mockResponseDetailOptions.map((option) => {
                      const isActive = settings.assistantResponseDetail === option.value;
                      return (
                        <label
                          key={option.value}
                          htmlFor={`detail-${option.value}`}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                            isActive ? "border-primary bg-primary/10" : "border-border bg-surface-low hover:bg-surface-high",
                          )}
                        >
                          <RadioGroupItem id={`detail-${option.value}`} value={option.value} className="mt-0.5" />
                          <span>
                            <span className={cn("block text-sm font-semibold", isActive ? "text-primary" : "text-foreground")}>
                              {option.label}
                            </span>
                            <span className="block text-xs text-muted-foreground">{option.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </div>

                <SettingsRow
                  label="Show budget suggestions"
                  description="Allow Aura to suggest adjustments based on your spending."
                  htmlFor="assistant-suggestions"
                  control={
                    <Switch
                      id="assistant-suggestions"
                      checked={settings.assistantShowSuggestions}
                      onCheckedChange={(v) => set("assistantShowSuggestions", v)}
                    />
                  }
                />

                <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-low p-3.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <p className="leading-relaxed">
                    Aura can analyze and explain your financial information, but it cannot modify
                    transactions or budgets.
                  </p>
                </div>
              </div>
            </SettingsSection>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button variant="ghost" onClick={handleReset} disabled={!isDirty}>
                Cancel
              </Button>
              <Button variant="brand" size="control" onClick={handleSave} disabled={!isDirty}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
