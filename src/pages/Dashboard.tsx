import { useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { Skeleton } from "../components/states/Skeleton";
import { TransactionDialog } from "../components/TransactionDialog";
import { SummaryStatCard } from "../components/dashboard/SummaryStatCard";
import { trendForHigherIsBetter, trendForLowerIsBetter } from "../components/dashboard/statTrend";
import { CashflowChartCard } from "../components/dashboard/CashflowChartCard";
import { SpendingBreakdownCard } from "../components/dashboard/SpendingBreakdownCard";
import { RecentActivityList } from "../components/dashboard/RecentActivityList";
import { BudgetSnapshot } from "../components/dashboard/BudgetSnapshot";
import { AuraEntryCard } from "../components/dashboard/AuraEntryCard";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { useProfile } from "../features/profiles/useProfile";
import { useDashboardData } from "../features/dashboard/useDashboardData";
import { useFormatCurrency } from "../features/profiles/useFormatPreferences";
import { useUserInfo } from "../shared/useUserId";
import type { TransactionWithCat } from "../lib/transactions";

export default function Dashboard() {
  const { userId } = useUserInfo();
  const [dialogTarget, setDialogTarget] = useState<"add" | TransactionWithCat | null>(null);
  const formatCurrency = useFormatCurrency();

  const profile = useProfile(userId);
  const dashboard = useDashboardData(userId);

  // Profile is optional presentation data on Dashboard -- it only backs the
  // personalized greeting below, which already has a real fallback when
  // there's no name to show. A profile-query failure must never blank the
  // whole page over that; every other real Dashboard dependency
  // (dashboard.transactions/.budgets) has its own independent error state
  // below. This mirrors how every other real profile consumer in the app
  // (ProfileMenu, TransactionFilterBar, TransactionForm, Reports, ...)
  // already treats profile.data as optional rather than gating rendering
  // on profile.isError -- Profile.tsx/Settings.tsx remain the only pages
  // where profile data is genuinely required to render at all, since they
  // ARE the profile editor.
  const firstName = profile.data?.full_name?.split(" ")[0];

  const summary = dashboard.summary;
  const income = trendForHigherIsBetter(summary?.month.income ?? 0, summary?.prevMonth.income ?? 0);
  const expenses = trendForLowerIsBetter(summary?.month.expenses ?? 0, summary?.prevMonth.expenses ?? 0);
  const net = trendForHigherIsBetter(summary?.month.net ?? 0, (summary?.prevMonth.income ?? 0) - (summary?.prevMonth.expenses ?? 0));
  const warningsCount = summary?.warningsCount ?? 0;

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[36px] lg:text-[44px] xl:text-[48px]">Command Center</h1>
          <p className="mt-1 text-[15px] text-muted-foreground sm:text-base lg:text-lg xl:text-xl">
            {firstName
              ? `Welcome back, ${firstName}. Here's an overview of your recent financial activity.`
              : "An overview of your recent financial activity."}
          </p>
        </div>
        <Button variant="hero" size="control" className="max-md:w-full" onClick={() => setDialogTarget("add")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Transaction
        </Button>
      </div>

      <div className="mt-6 md:mt-8">
        {dashboard.transactions.isLoading ? (
          <DashboardSkeleton />
        ) : dashboard.transactions.isError ? (
          <ErrorState
            title="Couldn't load your Dashboard"
            message="We couldn't load your transactions right now. Please try again."
            onRetry={dashboard.transactions.refetch}
          />
        ) : !dashboard.transactions.hasData ? (
          <EmptyState
            icon={Receipt}
            title="No activity yet"
            description="Add your first transaction to see your income, expenses, and spending trends here."
            action={
              <Button variant="hero" size="control" onClick={() => setDialogTarget("add")}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Transaction
              </Button>
            }
          />
        ) : (
          <div className="space-y-6 md:space-y-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SummaryStatCard
                label="Income (This Month)"
                value={formatCurrency(summary!.month.income)}
                trend={income.trend}
                tone={income.tone}
                trendLabel={income.label}
              />
              <SummaryStatCard
                label="Expenses (This Month)"
                value={formatCurrency(summary!.month.expenses)}
                trend={expenses.trend}
                tone={expenses.tone}
                trendLabel={expenses.label}
              />
              <SummaryStatCard
                label="Net Cash Flow (This Month)"
                value={formatCurrency(summary!.month.net)}
                trend={net.trend}
                tone={net.tone}
                trendLabel={net.label}
              />
              <SummaryStatCard
                label="Budget Warnings"
                value={String(warningsCount)}
                trend="flat"
                isWarning={warningsCount > 0}
                trendLabel={
                  warningsCount === 0
                    ? "All budgets on track"
                    : `${warningsCount} budget${warningsCount === 1 ? "" : "s"} need attention`
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <CashflowChartCard data={summary!.cashflow} />
              <AuraEntryCard />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SpendingBreakdownCard slices={summary!.categoryBreakdown} />
              <RecentActivityList items={summary!.recentTransactions} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {dashboard.budgets.isError ? (
                <ErrorState
                  className="md:col-span-2"
                  title="Couldn't load your budgets"
                  message="We couldn't load your budget progress right now. Please try again."
                  onRetry={dashboard.budgets.refetch}
                />
              ) : dashboard.budgets.isLoading ? (
                <Skeleton className="md:col-span-2 h-[220px] rounded-xl" />
              ) : (
                <BudgetSnapshot items={summary!.budgets} />
              )}
            </div>
          </div>
        )}
      </div>

      <TransactionDialog
        target={dialogTarget}
        onOpenChange={(open) => !open && setDialogTarget(null)}
        onSaved={() => {}}
      />
    </PageContainer>
  );
}
