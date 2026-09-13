import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "./ChartCard";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { CashflowPoint } from "../../features/dashboard/dashboardMath";

const ranges = { "6M": 6, "1Y": 12 } as const;
type Range = keyof typeof ranges;

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
          {p.dataKey === "income" ? "Income" : "Expenses"}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

/** Real income-vs-expenses history, bucketed by calendar month from the user's actual transactions (see dashboardMath.ts). */
export function CashflowChartCard({ data }: { data: CashflowPoint[] }) {
  const [range, setRange] = useState<Range>("6M");
  const visible = data.slice(-ranges[range]);

  return (
    <ChartCard
      title="Financial Trends"
      description="Income vs. expenses by month"
      className="md:col-span-2"
      actions={
        <div className="flex rounded-lg bg-surface-high p-1" role="tablist" aria-label="Chart range">
          {(Object.keys(ranges) as Range[]).map((r) => (
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
                  : "text-muted-foreground hover:text-foreground"
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
          <AreaChart data={visible} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="income-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="oklch(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenses-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(var(--warning))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(var(--warning))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="oklch(var(--outline-variant))" strokeOpacity={0.3} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
            />
            <Tooltip content={<CashflowTooltip />} cursor={{ stroke: "oklch(var(--outline-variant))" }} />
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="oklch(var(--primary))"
              fill="url(#income-gradient)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="oklch(var(--warning))"
              fill="url(#expenses-gradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <span className="sr-only">
        {visible
          .map((p) => `${p.month}: income ${formatCurrency(p.income)}, expenses ${formatCurrency(p.expenses)}`)
          .join(". ")}
      </span>
    </ChartCard>
  );
}
