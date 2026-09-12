import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string | undefined;
  icon?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
}) {
  return (
    <div className={cn("nexali-panel flex min-w-0 flex-col rounded-xl p-4 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold text-foreground">{title}</h2>
            {description && (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>
            )}
          </div>
        </div>
        {actions}
      </div>
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </div>
  );
}
