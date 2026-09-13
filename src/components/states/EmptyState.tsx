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
        "flex flex-col items-center justify-center rounded-xl border border-border/20 bg-gradient-card px-6 py-14 text-center",
        className
      )}
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="font-display mt-4 text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
