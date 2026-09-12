import { Sparkles } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import type { CashFlowPoint } from "@/mock/reports";
import { formatCurrency } from "@/lib/format";

const chartConfig: ChartConfig = {
  net: { label: "Net Cash Flow", color: "var(--color-success)" },
};

export function CashFlowTrendChart({
  data,
  averageSurplus,
  onPredict,
}: {
  data: CashFlowPoint[];
  averageSurplus: number;
  onPredict: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Average Monthly Surplus
          </p>
          <p className="numeric text-2xl font-semibold text-success">
            {formatCurrency(averageSurplus)}
          </p>
        </div>
        <Button variant="brand" size="control" onClick={onPredict} className="max-sm:w-full">
          <Sparkles className="h-4 w-4" />
          Predict Next Month
        </Button>
      </div>

      <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full sm:h-[260px]">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="netGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 4" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
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
                hideLabel={false}
                formatter={(value) => [formatCurrency(Number(value)), "Net"]}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="net"
            stroke="var(--color-net)"
            fill="url(#netGradient)"
            strokeWidth={3}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
