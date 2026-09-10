import { ShieldCheck } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { EmptyState } from "../components/states/EmptyState";

/**
 * Placeholder route only. The real Account page (email, password and
 * security, active sessions, privacy and data controls, account deletion)
 * is built in a later phase, kept separate from Profile and Settings per
 * docs/FRONTEND_REVAMP_PLAN.md.
 */
export default function Account() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Account</h1>
      <div className="mt-6">
        <EmptyState
          icon={ShieldCheck}
          title="Account settings are coming soon"
          description="Sign-in details, password and security, and data controls will live here in a later phase."
        />
      </div>
    </PageContainer>
  );
}
