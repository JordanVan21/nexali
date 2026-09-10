import { Settings as SettingsIcon } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { EmptyState } from "../components/states/EmptyState";

/**
 * Placeholder route only. The real Settings page (currency, timezone, date
 * and number format, budget-reset preferences, appearance, Aura
 * preferences) is built in a later phase, kept separate from Profile and
 * Account per docs/FRONTEND_REVAMP_PLAN.md.
 */
export default function Settings() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Settings</h1>
      <div className="mt-6">
        <EmptyState
          icon={SettingsIcon}
          title="Settings are coming soon"
          description="Currency, timezone, date and number format, and budget-reset preferences will live here in a later phase."
        />
      </div>
    </PageContainer>
  );
}
