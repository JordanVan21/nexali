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
        "flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-gradient-card px-6 py-14 text-center",
        className
      )}
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="font-display mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="surface" size="control" className="mt-5" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
