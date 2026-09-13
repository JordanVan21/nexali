import { Sparkles } from "lucide-react";

/**
 * Aura's welcome state. `firstName` is optional and purely cosmetic — real
 * profile data is never required to render Aura (see useProfile usage in
 * pages/Assistant.tsx, which never gates on it).
 */
export function AuraEmptyState({ firstName }: { firstName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary md:h-[72px] md:w-[72px]">
        <Sparkles className="h-8 w-8 md:h-9 md:w-9" aria-hidden="true" />
      </span>
      <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
        {firstName ? `Hello, ${firstName}. I'm Aura.` : "Hello. I'm Aura."}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground md:text-base">
        Your read-only Nexali financial assistant. Ask about your spending, budgets, or trends.
      </p>
    </div>
  );
}
