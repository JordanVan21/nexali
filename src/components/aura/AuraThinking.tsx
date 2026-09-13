import { Sparkles } from "lucide-react";

/**
 * Visual-only "Aura is thinking" indicator, built for future backend use.
 * Never triggered by a fake timeout in production — see useAuraConversation.ts.
 */
export function AuraThinking() {
  return (
    <div className="flex items-start gap-3" role="status" aria-label="Aura is thinking">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-none border border-outline-variant bg-surface-low px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none" />
      </div>
    </div>
  );
}
