import { AlertTriangle, Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SummaryStat } from "@/mock/dashboard";

const trendIcon: Record<SummaryStat["trend"], LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const trendTone: Record<SummaryStat["trend"], string> = {
  up: "text-success",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

function formatStatValue(stat: SummaryStat) {
  if (stat.format === "currency") return formatCurrency(stat.value, { signed: false });
  if (stat.format === "percent") return `${stat.value}%`;
  return stat.value.toString().padStart(2, "0");
}

export function SummaryStatCard({ stat }: { stat: SummaryStat }) {
  const TrendIcon = stat.id === "warnings" ? AlertTriangle : trendIcon[stat.trend];
  const isWarning = stat.id === "warnings";

  return (
    <div className="nexali-panel relative flex min-h-[152px] flex-col justify-between overflow-hidden rounded-xl p-5">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {stat.label}
          </span>
          <TrendIcon
            className={cn("h-4 w-4 shrink-0", isWarning ? "text-destructive" : trendTone[stat.trend])}
            aria-hidden="true"
          />
        </div>
        <p className="numeric font-display text-2xl font-bold text-foreground sm:text-[28px]">
          {formatStatValue(stat)}
        </p>
      </div>
      <p className={cn("mt-3 text-xs", isWarning ? "text-destructive" : "text-muted-foreground")}>
        {stat.trendLabel}
      </p>
    </div>
  );
}
