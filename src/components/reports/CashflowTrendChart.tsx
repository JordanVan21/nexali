import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { MonthlyBucket } from "../../lib/financialAnalytics";

function NetTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-outline-variant bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <p className="numeric text-muted-foreground">Net: {formatCurrency(payload[0].value)}</p>
    </div>
  );
}

/**
 * Real net cash flow (income - expenses) per month. No prediction/insight
 * is generated here — Aura has no backend yet, so this links to the real
 * Assistant page instead of fabricating a forecast.
 */
export function CashflowTrendChart({ data }: { data: MonthlyBucket[] }) {
  const netSeries = data.map((d) => ({ month: d.month, net: d.income - d.expenses }));
  const averageNet = netSeries.length > 0 ? netSeries.reduce((sum, d) => sum + d.net, 0) / netSeries.length : 0;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Average Monthly Net</p>
          <p className={cn("numeric text-2xl font-semibold", averageNet >= 0 ? "text-success" : "text-destructive")}>
            {formatCurrency(averageNet)}
          </p>
        </div>
        <Link
          to="/assistant"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/40 max-sm:w-full max-sm:justify-center"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Ask Aura About This Trend
        </Link>
      </div>

      <div className="h-[220px] w-full sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={netSeries} margin={{ left: 0, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="net-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="oklch(var(--success))" stopOpacity={0.25} />
                <stop offset="100%" stopColor="oklch(var(--success))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="oklch(var(--outline-variant))" strokeOpacity={0.3} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
            />
            <Tooltip content={<NetTooltip />} cursor={{ stroke: "oklch(var(--outline-variant))" }} />
            <Area type="monotone" dataKey="net" stroke="oklch(var(--success))" fill="url(#net-gradient)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <span className="sr-only">
        {netSeries.map((p) => `${p.month}: net ${formatCurrency(p.net)}`).join(". ")}
      </span>
    </div>
  );
}
