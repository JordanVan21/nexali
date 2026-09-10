import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * Shared empty-state block: icon, headline, supporting copy, and an
 * optional primary action. Used both for "no data exists yet" states and,
 * with a different icon/copy/action from the caller, for "no results match
 * your filters" states.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-border/20 bg-gradient-card px-6 py-16 text-center",
        className
      )}
    >
      <Icon className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
