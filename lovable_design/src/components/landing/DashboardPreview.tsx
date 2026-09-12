import { ArrowDownRight, ArrowUpRight, MoreHorizontal, ShoppingCart, Sparkles } from "lucide-react";

import { Progress } from "@/components/ui/progress";

const activity = [
  { name: "Whole Foods Market", meta: "Today · Groceries", amount: "-$84.20", tone: "text-foreground" },
  { name: "Payroll Deposit", meta: "Yesterday · Income", amount: "+$4,200.00", tone: "text-success" },
  { name: "Electric Co.", meta: "Dec 22 · Utilities", amount: "-$118.50", tone: "text-foreground" },
];

export function DashboardPreview() {
  return (
    <div className="nexali-panel relative overflow-hidden rounded-2xl border border-outline-variant bg-card/70 p-4 shadow-2xl backdrop-blur md:p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="rounded-xl border border-outline-variant bg-surface-low p-4 md:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-foreground">Recent activity</h3>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            {activity.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 rounded-lg p-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
                  </div>
                </div>
                <p className={`numeric shrink-0 text-sm font-medium ${item.tone}`}>{item.amount}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 md:col-span-5">
          <div className="rounded-xl border border-outline-variant bg-surface-low p-4">
            <p className="text-sm text-muted-foreground">Housing budget</p>
            <p className="numeric mt-1 text-2xl font-semibold text-foreground">
              $2,100 <span className="text-sm font-normal text-muted-foreground">of $2,500</span>
            </p>
            <Progress value={84} className="mt-3 h-2" />
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface-low p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">Ask Aura</p>
            </div>
            <p className="mt-2 rounded-lg bg-primary/10 p-2 text-xs text-foreground">
              "How does my dining spend compare to last month?"
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowDownRight className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              15% lower than your 6-month average.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
