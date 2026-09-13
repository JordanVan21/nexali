import { ArrowDownRight, MoreHorizontal, Sparkles } from "lucide-react";
import { Progress } from "../ui/progress";
import { getCategoryIcon } from "../../lib/categoryIcon";

/**
 * Illustrative preview of the real Dashboard/Budgets/Aura experience for the
 * public Landing page. Demo data only, clearly promotional -- not a claim
 * about live or connected data (see the real authenticated Dashboard for
 * that). Category icons reuse the real deterministic lookup for a touch of
 * authenticity even in the demo.
 */
const PREVIEW_ACTIVITY = [
  { name: "Whole Foods Market", meta: "Today · Groceries", amount: "-$84.20", tone: "text-foreground", category: "Groceries" },
  { name: "Payroll Deposit", meta: "Yesterday · Income", amount: "+$4,200.00", tone: "text-success", category: "Income" },
  { name: "Electric Co.", meta: "Dec 22 · Utilities", amount: "-$118.50", tone: "text-foreground", category: "Utilities" },
];

export function DashboardPreview() {
  return (
    <div className="nexali-panel relative overflow-hidden rounded-2xl border border-outline-variant bg-card/70 p-4 shadow-2xl backdrop-blur md:p-6 xl:p-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 xl:gap-6">
        <div className="rounded-xl border border-outline-variant bg-surface-low p-4 md:col-span-7 xl:p-6">
          <div className="mb-4 flex items-center justify-between xl:mb-5">
            <h3 className="font-display text-base font-semibold text-foreground xl:text-lg">Recent activity</h3>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground xl:h-5 xl:w-5" aria-hidden="true" />
          </div>
          <div className="space-y-2 xl:space-y-3">
            {PREVIEW_ACTIVITY.map((item) => {
              const Icon = getCategoryIcon(item.category);
              return (
                <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg p-2 xl:p-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary xl:h-10 xl:w-10">
                      <Icon className="h-4 w-4 xl:h-[18px] xl:w-[18px]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground xl:text-base">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground xl:text-sm">{item.meta}</p>
                    </div>
                  </div>
                  <p className={`numeric shrink-0 text-sm font-medium xl:text-base ${item.tone}`}>{item.amount}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 md:col-span-5 xl:gap-6">
          <div className="rounded-xl border border-outline-variant bg-surface-low p-4 xl:p-6">
            <p className="text-sm text-muted-foreground xl:text-base">Housing budget</p>
            <p className="numeric mt-1 text-2xl font-semibold text-foreground xl:text-3xl">
              $2,100 <span className="text-sm font-normal text-muted-foreground xl:text-base">of $2,500</span>
            </p>
            <Progress value={84} className="mt-3 xl:h-2.5" />
          </div>
          <div className="rounded-xl border border-outline-variant bg-surface-low p-4 xl:p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary xl:h-5 xl:w-5" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground xl:text-base">Ask Aura</p>
            </div>
            <p className="mt-2 rounded-lg bg-primary/10 p-2 text-xs text-foreground xl:mt-3 xl:p-3 xl:text-sm">
              "How does my dining spend compare to last month?"
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground xl:mt-3 xl:text-sm">
              <ArrowDownRight className="h-3.5 w-3.5 text-success xl:h-4 xl:w-4" aria-hidden="true" />
              15% lower than your 6-month average.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
