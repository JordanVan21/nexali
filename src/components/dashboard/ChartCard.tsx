import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Shared card shell for every Dashboard/Reports chart-style panel. */
export function ChartCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("nexali-panel flex flex-col rounded-xl p-4 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-display truncate text-lg font-semibold text-foreground lg:text-xl xl:text-2xl">{title}</h2>
          </div>
          {description && <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
