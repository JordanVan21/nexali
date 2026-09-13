import type { FormEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "../ui/button";

/**
 * Aura's message composer. Fully interactive (typing, starter-prompt
 * fill-in, keyboard submit) so it's ready for real backend wiring — only
 * what happens on submit is backend-dependent (see useAuraConversation.ts,
 * which never fabricates a reply).
 */
export function AuraComposer({
  value,
  onValueChange,
  onSend,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (message: string) => void;
}) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-high p-2 pl-4 focus-within:border-primary">
        <label htmlFor="aura-composer-input" className="sr-only">
          Ask Aura anything about your finances
        </label>
        <input
          id="aura-composer-input"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Ask Aura anything about your finances…"
          className="min-h-11 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-base"
        />
        <Button type="submit" size="icon-lg" variant="hero" disabled={!value.trim()} aria-label="Send message">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
        Aura isn't connected to your financial data yet.
      </p>
    </form>
  );
}
