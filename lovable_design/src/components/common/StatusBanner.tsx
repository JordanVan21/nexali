import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusBannerTone = "success" | "info" | "warning";

const toneConfig: Record<StatusBannerTone, { icon: LucideIcon; classes: string }> = {
  success: {
    icon: CheckCircle2,
    classes: "border-success/30 bg-success/10 text-success",
  },
  info: {
    icon: Info,
    classes: "border-primary/30 bg-primary/10 text-primary",
  },
  warning: {
    icon: TriangleAlert,
    classes: "border-warning/30 bg-warning/10 text-warning",
  },
};

export function StatusBanner({
  tone = "success",
  title,
  description,
  onDismiss,
  className,
}: {
  tone?: StatusBannerTone;
  title: string;
  description?: string;
  onDismiss?: () => void;
  className?: string;
}) {
  const { icon: Icon, classes } = toneConfig[tone];
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        classes,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{title}</p>
        {description && <p className="mt-0.5 text-xs opacity-90">{description}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
