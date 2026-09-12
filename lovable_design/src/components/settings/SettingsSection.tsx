import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsSection({
  id,
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  divided = false,
}: {
  id?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Divide direct row children with a hairline instead of stacked gaps. */
  divided?: boolean;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
            <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          </div>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div
        className={cn(
          "nexali-panel rounded-xl p-4 sm:p-6",
          divided && "divide-y divide-border [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0",
        )}
      >
        {children}
      </div>
    </section>
  );
}
