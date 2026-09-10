import { Bell } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { EmptyState } from "../components/states/EmptyState";

/**
 * Placeholder route only. The real Notifications page is built in a later
 * phase.
 */
export default function Notifications() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">Notifications</h1>
      <div className="mt-6">
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Budget alerts and account notifications will appear here in a later phase."
        />
      </div>
    </PageContainer>
  );
}
