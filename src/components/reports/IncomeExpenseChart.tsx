import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "../../lib/format";
import type { MonthlyBucket } from "../../lib/financialAnalytics";

function IncomeExpenseTooltip({
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

/** Real income vs. expenses per month, from the user's actual transactions (see useReportsData.ts). */
export function IncomeExpenseChart({ data }: { data: MonthlyBucket[] }) {
  return (
    <>
      <div className="h-[260px] w-full sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke="oklch(var(--outline-variant))" strokeOpacity={0.3} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "oklch(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
            />
            <Tooltip content={<IncomeExpenseTooltip />} cursor={{ fill: "oklch(var(--outline-variant) / 15%)" }} />
            <Bar dataKey="income" name="Income" fill="oklch(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="expenses" name="Expenses" fill="oklch(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-outline-variant pt-4 text-sm">
        <span className="flex items-center gap-2 text-foreground">
          <span className="h-3 w-3 rounded-full bg-success" aria-hidden="true" />
          Income
        </span>
        <span className="flex items-center gap-2 text-foreground">
          <span className="h-3 w-3 rounded-full bg-primary" aria-hidden="true" />
          Expenses
        </span>
      </div>
      <span className="sr-only">
        {data.map((p) => `${p.month}: income ${formatCurrency(p.income)}, expenses ${formatCurrency(p.expenses)}`).join(". ")}
      </span>
    </>
  );
}
