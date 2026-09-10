import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type ErrorStateProps = {
  title?: string;
  /** User-safe message. Never pass a raw database or network error string here. */
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/**
 * Shared error-state block for a section or page that failed to load.
 * Deliberately does not accept a raw error object: callers translate the
 * error into a short, user-safe message before rendering this.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this right now. Please try again.",
  onRetry,
  retryLabel = "Retry",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-gradient-card px-6 py-16 text-center",
        className
      )}
    >
      <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
