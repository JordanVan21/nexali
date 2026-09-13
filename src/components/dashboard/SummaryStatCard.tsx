import { AlertTriangle, Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

/** Arrow direction only — which way the number actually moved. Never inverted, so the icon never visually contradicts the real change. */
export type StatTrend = "up" | "down" | "flat";
/** Color meaning — separate from direction, since "expenses went up" is a real up-arrow but a bad (destructive) result. */
export type StatTone = "success" | "destructive" | "muted";

const trendIcon: Record<StatTrend, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const toneClass: Record<StatTone, string> = {
  success: "text-success",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

export type SummaryStatCardProps = {
  label: string;
  value: string;
  trend: StatTrend;
  tone?: StatTone;
  trendLabel: string;
  /** Warning styling (destructive icon/text) for the budget-warnings card. */
  isWarning?: boolean;
};

export function SummaryStatCard({
  label,
  value,
  trend,
  tone = "muted",
  trendLabel,
  isWarning = false,
}: SummaryStatCardProps) {
  const TrendIcon = isWarning ? AlertTriangle : trendIcon[trend];
  const resolvedTone = isWarning ? "destructive" : tone;

  return (
    <div className="nexali-panel relative flex min-h-[152px] flex-col justify-between overflow-hidden rounded-xl p-5 xl:min-h-[168px] xl:p-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground xl:text-sm">{label}</span>
          <TrendIcon className={cn("h-4 w-4 shrink-0 xl:h-5 xl:w-5", toneClass[resolvedTone])} aria-hidden="true" />
        </div>
        <p className="numeric font-display text-2xl font-bold text-foreground sm:text-[28px] xl:text-[34px]">{value}</p>
      </div>
      <p className={cn("mt-3 text-xs xl:text-sm", isWarning ? "text-destructive" : "text-muted-foreground")}>
        {trendLabel}
      </p>
    </div>
  );
}
