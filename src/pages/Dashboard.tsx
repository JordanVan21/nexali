import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { useProfile } from "../features/profiles/useProfile.ts";
import { useTotals } from "../features/dashboard/useTotals.ts";
import { useUserInfo } from "../shared/useUserId.ts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Calendar } from "lucide-react";

const CURRENCY = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});
const MonthNetWidget = ({ netAmount }: { netAmount: number }) => {
  const isPositive = netAmount >= 0;

  return (
    <div className="bg-gradient-card border border-border/20 rounded-xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-card-foreground">
          Month Net
        </h3>
        {isPositive ? (
          <TrendingUp className="h-5 w-5 text-primary" />
        ) : (
          <TrendingDown className="h-5 w-5 text-destructive" />
        )}
      </div>
      <div
        className={`text-3xl font-bold ${
          isPositive ? "text-primary" : "text-destructive"
        }`}
      >
        {CURRENCY.format(netAmount)}
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        Income - Expenses this month
      </p>
    </div>
  );
};

const MonthIncomeExpenseWidget = ({
  income,
  spent,
  chartData,
  isLoading,
  isError,
}: {
  income: number;
  spent: number;
  chartData: Array<{ name: string; value: number }>;
  isLoading: boolean;
  isError: boolean;
}) => {
  return (
    <div className="bg-gradient-card border border-border/20 shadow-card rounded-2xl w-full max-w-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">This Month</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-xl font-semibold text-card-foreground">
                  Income:
                </span>
                <span className="text-lg text-primary">
                  {isLoading ? "…" : CURRENCY.format(income)}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xl font-semibold text-card-foreground">
                  Spent:
                </span>
                <span className="text-lg text-destructive">
                  {isLoading ? "…" : CURRENCY.format(spent)}
                </span>
              </div>
            </div>

            <div className="w-[280px] h-[140px] overflow-hidden flex items-end">
              <PieChart width={280} height={140}>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={80}
                  outerRadius={110}
                  dataKey="value"
                >
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        i === 0
                          ? "hsl(var(--destructive))"
                          : "hsl(var(--primary))"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) =>
                    name === "Spent"
                      ? [`${Number(v).toFixed(2)}% used`, ""]
                      : [`${Number(v).toFixed(2)}% left`, ""]
                  }
                  contentStyle={{
                    fontSize: "0.875rem",
                  }}
                />
              </PieChart>
            </div>
          </div>

          {isError && (
            <div className="text-sm text-destructive mt-3">
              Failed to load totals
            </div>
          )}
      </div>
  )
};

export default function Dashboard() {
  const { userId } = useUserInfo();
  const [typed, setTyped] = useState("");

  const profile = useProfile(userId);
  const totals = useTotals(userId);

  const fullName = profile.data?.full_name ?? "";
  const income = totals.data?.income ?? 0;
  const spent = totals.data?.spent ?? 0;

  useEffect(() => {
    if (!fullName) {
      setTyped("");
      return;
    }
    const target = `Welcome ${fullName}`;
    let i = 0;
    setTyped("");
    const id = setInterval(() => {
      i += 1;
      setTyped(target.slice(0, i));
      if (i >= target.length) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [fullName]);

  const safePct = (num: number, den: number) =>
    den > 0 ? (num / den) * 100 : 0;
  const pct = safePct(spent, income);
  const remainingPct = safePct(Math.max(income - spent, 0), income);

  const chartData = useMemo(
    () => [
      { name: "Spent", value: pct },
      { name: "Remaining", value: remainingPct },
    ],
    [pct, remainingPct]
  );

  if (profile.isError) {
    return (
      <div className="p-6 text-red-500">
        {profile.error?.message ?? "Failed to load profile"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative flex items-center justify-between px-6 lg:px-14 pt-20 pb-16">
        <div className="flex-1">
          <div className="text-2xl md:text-4xl lg:text-6xl font-extrabold text-foreground mb-8">
            {profile.isLoading ? "Welcome..." : typed}
            {(profile.isLoading || typed.length > 0) && (
              <span className="animate-pulse">|</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-14 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MonthNetWidget netAmount={income - spent} />
          <MonthIncomeExpenseWidget 
            income={income}
            spent={spent}
            chartData={chartData}
            isLoading={totals.isLoading}
            isError={totals.isError}
          />
        </div>
      </div>
    </div>
  );
}
