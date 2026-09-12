import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CashflowPoint } from "@/mock/dashboard";

const ranges = ["6M", "1Y"] as const;

function CashflowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-outline-variant bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="numeric text-muted-foreground">
          {p.dataKey === "income" ? "Income" : "Expenses"}: {formatCurrency(p.value, { signed: false })}
        </p>
      ))}
    </div>
  );
}

export function CashflowChartCard({ data }: { data: CashflowPoint[] }) {
  const [range, setRange] = useState<(typeof ranges)[number]>("6M");

  return (
    <ChartCard
      title="Financial Trends"
      description="Income vs. expenses over time"
      className="md:col-span-2"
      actions={
        <div className="flex rounded-lg bg-surface-high p-1" role="tablist" aria-label="Chart range">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                range === r
                  ? "bg-surface-highest text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-[280px] w-full sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="income-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenses-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-warning)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-warning)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-outline-variant)" strokeOpacity={0.3} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
            />
            <Tooltip content={<CashflowTooltip />} cursor={{ stroke: "var(--color-outline-variant)" }} />
            <Area
              type="monotone"
              dataKey="income"
              stroke="var(--color-primary)"
              fill="url(#income-gradient)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="var(--color-warning)"
              fill="url(#expenses-gradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
