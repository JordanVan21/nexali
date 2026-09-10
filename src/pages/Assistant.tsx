import { Sparkles } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { EmptyState } from "../components/states/EmptyState";

/**
 * Placeholder route only. Aura's real conversational interface is built in
 * a later phase (see docs/FRONTEND_REVAMP_PLAN.md §10, §13). This page
 * exists so the shell's navigation has a real destination to link to.
 */
export default function Assistant() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Aura</h1>
      <div className="mt-6">
        <EmptyState
          icon={Sparkles}
          title="Aura is coming soon"
          description="Your read-only financial assistant will appear here in a later phase."
        />
      </div>
    </PageContainer>
  );
}
