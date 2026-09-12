import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { CategorySlice } from "@/mock/reports";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE_DOT: Record<CategorySlice["color"], string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

export function SpendingByCategoryChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const config: ChartConfig = Object.fromEntries(
    data.map((d) => [d.id, { label: d.name, color: `var(--color-${d.color})` }]),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto aspect-square w-full max-w-[220px]">
        <ChartContainer config={config} className="aspect-square h-full w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => [
                    formatCurrency(Number(value), { signed: false }),
                    String(item.payload.name),
                  ]}
                />
              }
            />
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              innerRadius="65%"
              outerRadius="100%"
              strokeWidth={2}
              stroke="var(--color-surface)"
            >
              {data.map((d) => (
                <Cell key={d.id} fill={`var(--color-${d.color})`} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="numeric text-lg font-semibold text-foreground">
            {formatCurrency(total, { signed: false })}
          </span>
        </div>
      </div>

      <ul className="space-y-2" aria-label="Spending by category legend">
        {data.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[d.color])} aria-hidden />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="numeric shrink-0 text-muted-foreground">
              {formatCurrency(d.amount, { signed: false })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
