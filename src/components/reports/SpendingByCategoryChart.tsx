import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { useFormatCurrency } from "../../features/profiles/useFormatPreferences";
import type { CategoryAmount } from "../../lib/financialAnalytics";

const SLICE_TONES = ["oklch(var(--primary))", "oklch(var(--success))", "oklch(var(--warning))", "oklch(var(--destructive))"];
const DOT_TONES = ["bg-primary", "bg-success", "bg-warning", "bg-destructive"];

function SliceTooltip({ active, payload }: { active?: boolean; payload?: { value: number; name: string }[] }) {
  const formatCurrency = useFormatCurrency();
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-outline-variant bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="numeric font-medium text-foreground">
        {p.name}: {formatCurrency(p.value)}
      </p>
    </div>
  );
}

/** Real expense breakdown for the selected period/category filter (see useReportsData.ts). Income is never included. */
export function SpendingByCategoryChart({ data }: { data: CategoryAmount[] }) {
  const formatCurrency = useFormatCurrency();
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  if (data.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <PieChartIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">No expenses recorded for this period.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto aspect-square w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<SliceTooltip />} />
            <Pie
              data={data.map((d) => ({ name: d.label, value: d.amount }))}
              dataKey="value"
              nameKey="name"
              innerRadius="65%"
              outerRadius="100%"
              strokeWidth={2}
              stroke="oklch(var(--surface))"
            >
              {data.map((d, i) => (
                <Cell key={d.id} fill={SLICE_TONES[i % SLICE_TONES.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="numeric text-lg font-semibold text-foreground">{formatCurrency(total)}</span>
        </div>
      </div>

      <ul className="space-y-2" aria-label="Spending by category legend">
        {data.map((d, i) => (
          <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_TONES[i % DOT_TONES.length]}`} aria-hidden="true" />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="numeric shrink-0 text-muted-foreground">{formatCurrency(d.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
