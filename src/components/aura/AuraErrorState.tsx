import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";

/**
 * Visual-only "Aura is unavailable" presentation, built for future backend
 * use. Never triggered by a real network call in Part 6 — there is no
 * request that can fail yet. The rest of the app never depends on Aura
 * being reachable (see docs/DESIGN_SYSTEM.md §15).
 */
export function AuraErrorState({
  message = "Aura couldn't respond right now. The rest of Nexali still works normally.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-[90%] flex-col items-center gap-2 rounded-xl border border-destructive/20 bg-surface-low px-4 py-4 text-center sm:max-w-[75%]"
    >
      <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
