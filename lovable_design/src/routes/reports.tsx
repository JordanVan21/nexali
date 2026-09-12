import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3, PieChart } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { ReportControls } from "@/components/reports/ReportControls";
import { SummaryStats } from "@/components/reports/SummaryStats";
import { ChartCard } from "@/components/reports/ChartCard";
import { IncomeExpenseChart } from "@/components/reports/IncomeExpenseChart";
import { SpendingByCategoryChart } from "@/components/reports/SpendingByCategoryChart";
import { CashFlowTrendChart } from "@/components/reports/CashFlowTrendChart";
import { TopCategoriesBreakdown } from "@/components/reports/TopCategoriesBreakdown";
import {
  mockAverageMonthlySurplus,
  mockCashFlowByPeriod,
  mockCategoryFilters,
  mockReportSummary,
  mockReportsByPeriod,
  mockSpendingByCategory,
  mockTopCategories,
  type ReportPeriod,
} from "@/mock/reports";

const title = "Reports — Nexali";
const description = "Analyze income, spending and cash flow trends across your Nexali accounts.";

export const Route = createFileRoute("/reports")({
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
  component: ReportsPage,
});

function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("12m");
  const [category, setCategory] = useState<string>(mockCategoryFilters[0]!);

  const flowData = useMemo(() => mockReportsByPeriod[period], [period]);
  const cashFlowData = useMemo(() => mockCashFlowByPeriod[period], [period]);

  const categorySlices = useMemo(() => {
    if (category === "All Categories") return mockSpendingByCategory;
    return mockSpendingByCategory.filter(
      (c) => c.name.toLowerCase() === category.toLowerCase(),
    );
  }, [category]);

  const handleExport = () => {
    toast.success("Report exported", { description: "Your CSV export has started downloading." });
  };

  const handlePredict = () => {
    toast("Aura is analyzing your trends…", {
      description: "Predicted next month surplus: +$2,680.00",
    });
  };

  return (
    <AppShell activeKey="reports">
      <PageContainer>
        <PageHeader
          title="Financial Intelligence"
          description="Your fiscal ecosystem, analyzed across connected accounts."
          actions={
            <ReportControls
              period={period}
              onPeriodChange={setPeriod}
              category={category}
              onCategoryChange={setCategory}
              categories={mockCategoryFilters}
              onExport={handleExport}
            />
          }
        />

        <div className="mb-4 md:mb-8">
          <SummaryStats
            totalIncome={mockReportSummary.totalIncome}
            totalExpenses={mockReportSummary.totalExpenses}
            netSavings={mockReportSummary.netSavings}
            savingsRatePercent={mockReportSummary.savingsRatePercent}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
          <ChartCard
            title="Income vs. Expenses"
            icon={<BarChart3 className="h-5 w-5 text-primary" aria-hidden />}
            className="md:col-span-8"
          >
            <IncomeExpenseChart data={flowData} />
          </ChartCard>

          <ChartCard
            title="Spending"
            icon={<PieChart className="h-5 w-5 text-muted-foreground" aria-hidden />}
            className="md:col-span-4"
          >
            <SpendingByCategoryChart data={categorySlices} />
          </ChartCard>

          <ChartCard
            title="Net Cash Flow"
            description="Surplus vs. deficit trajectory"
            className="md:col-span-12"
          >
            <CashFlowTrendChart
              data={cashFlowData}
              averageSurplus={mockAverageMonthlySurplus}
              onPredict={handlePredict}
            />
          </ChartCard>

          <div className="md:col-span-12">
            <TopCategoriesBreakdown categories={mockTopCategories} />
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
