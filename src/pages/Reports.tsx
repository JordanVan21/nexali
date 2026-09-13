import { useState } from "react";
import { Link } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { Button } from "../components/ui/button";
import { ChartCard } from "../components/dashboard/ChartCard";
import { SummaryStatCard, type StatTrend, type StatTone } from "../components/dashboard/SummaryStatCard";
import { trendForHigherIsBetter, trendForLowerIsBetter } from "../components/dashboard/statTrend";
import { ReportsControls } from "../components/reports/ReportsControls";
import { IncomeExpenseChart } from "../components/reports/IncomeExpenseChart";
import { SpendingByCategoryChart } from "../components/reports/SpendingByCategoryChart";
import { CashflowTrendChart } from "../components/reports/CashflowTrendChart";
import { TopCategoriesTable } from "../components/reports/TopCategoriesTable";
import { BudgetPerformanceSection } from "../components/reports/BudgetPerformanceSection";
import { ReportsSkeleton } from "../components/reports/ReportsSkeleton";
import { useReportsData, REPORT_PERIODS, ALL_CATEGORIES, type ReportPeriodOption } from "../features/reports/useReportsData";
import { buildTransactionsCsv, downloadCsv } from "../lib/csvExport";
import { formatCurrency } from "../lib/format";
import { useUserInfo } from "../shared/useUserId";

/** Percentage-point difference, for comparing two rates without the confusing "% change of a %" framing. */
function savingsRateTrend(
  current: number | null,
  previous: number | null,
  comparisonLabel: string
): { trend: StatTrend; tone: StatTone; label: string } {
  if (current === null || previous === null) {
    return { trend: "flat", tone: "muted", label: `No data for ${comparisonLabel} yet` };
  }
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) {
    return { trend: "flat", tone: "muted", label: `About the same as ${comparisonLabel}` };
  }
  return {
    trend: diff > 0 ? "up" : "down",
    tone: diff > 0 ? "success" : "destructive",
    label: `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pts vs ${comparisonLabel}`,
  };
}

export default function Reports() {
  const { userId } = useUserInfo();
  const [period, setPeriod] = useState<ReportPeriodOption>(6);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  const data = useReportsData(userId, period, category);
  const comparisonLabel = REPORT_PERIODS.find((p) => p.value === period)!.comparisonLabel;

  const isLoading = data.transactionsList.isLoading || data.budgetsList.isLoading;

  const income = trendForHigherIsBetter(data.totals.income, data.previousTotals?.income ?? 0, comparisonLabel);
  const expenses = trendForLowerIsBetter(data.totals.expenses, data.previousTotals?.expenses ?? 0, comparisonLabel);
  const net = trendForHigherIsBetter(data.totals.net, data.previousTotals?.net ?? 0, comparisonLabel);
  const previousSavingsRate = data.previousTotals
    ? data.previousTotals.income > 0
      ? ((data.previousTotals.income - data.previousTotals.expenses) / data.previousTotals.income) * 100
      : null
    : null;
  const savingsTrend = savingsRateTrend(data.savingsRatePercent, previousSavingsRate, comparisonLabel);

  const handleExport = () => {
    const csv = buildTransactionsCsv(data.transactionsInRange);
    downloadCsv(`nexali-transactions-${period}mo.csv`, csv);
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl xl:text-[32px] 2xl:text-[34px]">Financial Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Analyze your income, spending, and cash flow trends.</p>
        </div>
        <ReportsControls
          period={period}
          onPeriodChange={setPeriod}
          category={category}
          onCategoryChange={setCategory}
          categories={data.categoryNames}
          onExport={handleExport}
          exportDisabled={data.transactionsInRange.length === 0}
        />
      </div>

      <div className="mt-6 md:mt-8 xl:mt-10">
        {isLoading ? (
          <ReportsSkeleton />
        ) : data.transactionsList.isError ? (
          <ErrorState
            title="Couldn't load your reports"
            message="We couldn't load your transactions right now. Please try again."
            onRetry={data.transactionsList.refetch}
          />
        ) : !data.transactionsList.hasAnyDataEver ? (
          <EmptyState
            icon={ReceiptText}
            title="No activity yet"
            description="Add some transactions to see income, spending, and cash flow trends here."
            action={
              <Button variant="hero" asChild>
                <Link to="/transactions">Add Transaction</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              <SummaryStatCard
                label="Total Income"
                value={formatCurrency(data.totals.income)}
                trend={income.trend}
                tone={income.tone}
                trendLabel={income.label}
              />
              <SummaryStatCard
                label="Total Expenses"
                value={formatCurrency(data.totals.expenses)}
                trend={expenses.trend}
                tone={expenses.tone}
                trendLabel={expenses.label}
              />
              <SummaryStatCard
                label="Net Savings"
                value={formatCurrency(data.totals.net)}
                trend={net.trend}
                tone={net.tone}
                trendLabel={net.label}
              />
              <SummaryStatCard
                label="Savings Rate"
                value={data.savingsRatePercent !== null ? `${data.savingsRatePercent.toFixed(1)}%` : "—"}
                trend={savingsTrend.trend}
                tone={savingsTrend.tone}
                trendLabel={savingsTrend.label}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <ChartCard
                title="Income vs. Expenses"
                description="Real monthly totals for the selected period"
                className="md:col-span-8"
              >
                <IncomeExpenseChart data={data.monthlyBuckets} />
              </ChartCard>

              <ChartCard title="Spending" description="By category" className="md:col-span-4">
                <SpendingByCategoryChart data={data.categoryTotals} />
              </ChartCard>
            </div>

            <ChartCard title="Net Cash Flow" description="Surplus vs. deficit by month">
              <CashflowTrendChart data={data.monthlyBuckets} />
            </ChartCard>

            <TopCategoriesTable
              categories={data.categoryTotals}
              previousCategories={data.previousCategoryTotals}
              comparisonLabel={comparisonLabel}
            />

            {data.budgetsList.isError ? (
              <ErrorState
                title="Couldn't load your budgets"
                message="We couldn't load your budget performance right now. Please try again."
                onRetry={data.budgetsList.refetch}
              />
            ) : (
              <BudgetPerformanceSection budgets={data.budgetsInRange} />
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
