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
import { formatCurrency } from "../lib/format";
import { useUserInfo } from "../shared/useUserId";
import type { TransactionWithCat } from "../lib/transactions";

export default function Dashboard() {
  const { userId } = useUserInfo();
  const [dialogTarget, setDialogTarget] = useState<"add" | TransactionWithCat | null>(null);

  const profile = useProfile(userId);
  const dashboard = useDashboardData(userId);

  const firstName = profile.data?.full_name?.split(" ")[0];

  if (profile.isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Couldn't load your profile"
          message="We couldn't load your account right now. Please try again."
        />
      </PageContainer>
    );
  }

  const summary = dashboard.summary;
  const income = trendForHigherIsBetter(summary?.month.income ?? 0, summary?.prevMonth.income ?? 0);
  const expenses = trendForLowerIsBetter(summary?.month.expenses ?? 0, summary?.prevMonth.expenses ?? 0);
  const net = trendForHigherIsBetter(summary?.month.net ?? 0, (summary?.prevMonth.income ?? 0) - (summary?.prevMonth.expenses ?? 0));
  const warningsCount = summary?.warningsCount ?? 0;

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl xl:text-[32px] 2xl:text-[34px]">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
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

      <div className="mt-6 md:mt-8 xl:mt-10">
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
              <Button variant="hero" onClick={() => setDialogTarget("add")}>
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
                  className="md:col-span-3"
                  title="Couldn't load your budgets"
                  message="We couldn't load your budget progress right now. Please try again."
                  onRetry={dashboard.budgets.refetch}
                />
              ) : dashboard.budgets.isLoading ? (
                <Skeleton className="md:col-span-3 h-[220px] rounded-xl" />
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
