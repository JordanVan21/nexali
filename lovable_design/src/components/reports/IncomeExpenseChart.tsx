import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MonthlyFlow } from "@/mock/reports";
import { formatCurrency } from "@/lib/format";

const chartConfig: ChartConfig = {
  income: { label: "Income", color: "var(--color-success)" },
  expenses: { label: "Expenses", color: "var(--color-primary)" },
};

export function IncomeExpenseChart({ data }: { data: MonthlyFlow[] }) {
  return (
    <>
      <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full sm:h-[320px]">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 4" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="text-xs"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={48}
            className="text-xs"
            tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => [
                  formatCurrency(Number(value), { signed: false }),
                  name === "income" ? "Income" : "Expenses",
                ]}
              />
            }
          />
          <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ChartContainer>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4 text-sm">
        <span className="flex items-center gap-2 text-foreground">
          <span className="h-3 w-3 rounded-full bg-success" aria-hidden />
          Income
        </span>
        <span className="flex items-center gap-2 text-foreground">
          <span className="h-3 w-3 rounded-full bg-primary" aria-hidden />
          Expenses
        </span>
      </div>
    </>
  );
}
