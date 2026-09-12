import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { SummaryStatCard } from "@/components/dashboard/SummaryStatCard";
import { CashflowChartCard } from "@/components/dashboard/CashflowChartCard";
import { SpendingBreakdownCard } from "@/components/dashboard/SpendingBreakdownCard";
import { RecentActivityList } from "@/components/dashboard/RecentActivityList";
import { BudgetSnapshot } from "@/components/dashboard/BudgetSnapshot";
import { AiInsightCard } from "@/components/dashboard/AiInsightCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import {
  mockAiInsight,
  mockBudgetSnapshot,
  mockCashflow,
  mockRecentActivity,
  mockSpendingBreakdown,
  mockSummaryStats,
} from "@/mock/dashboard";
import { mockUser } from "@/mock/profile";

const title = "Dashboard — Nexali";
const description = "Your financial command center: net worth, cash flow, spending and budgets at a glance.";

export const Route = createFileRoute("/dashboard")({
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
  component: DashboardPage,
});

function DashboardPage() {
  // Local mock state only — swap for real Nexali hooks during integration.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <AppShell activeKey="dashboard" userName={mockUser.name}>
      <PageContainer>
        <PageHeader
          title="Command Center"
          description={`Welcome back, ${mockUser.name.split(" ")[0]}. Your financial ecosystem is healthy.`}
          actions={
            <Button variant="brand" size="control" className="max-md:w-full">
              <Plus className="h-4 w-4" />
              New Transaction
            </Button>
          }
        />

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-6 md:space-y-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {mockSummaryStats.map((stat) => (
                <SummaryStatCard key={stat.id} stat={stat} />
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <CashflowChartCard data={mockCashflow} />
              <AiInsightCard {...mockAiInsight} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SpendingBreakdownCard slices={mockSpendingBreakdown} />
              <RecentActivityList items={mockRecentActivity} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <BudgetSnapshot items={mockBudgetSnapshot} />
            </div>
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}
