import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

const STARTER_QUESTIONS = [
  "How is my spending trending?",
  "Which budgets need attention?",
  "What did I spend on last?",
];

/**
 * Dashboard entry point to Aura (MASTER_SPEC's "smaller optional assistant
 * panel... must link to the complete Assistant experience"). Unlike
 * Lovable's AiInsightCard, this never fabricates a personalized insight
 * sentence — Aura has no backend yet, so the copy stays a generic,
 * truthful invitation with starter questions that just navigate to the
 * real Assistant page rather than pretending to answer them here.
 */
export function AuraEntryCard() {
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-5">
      <Sparkles
        className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 text-primary opacity-10"
        aria-hidden="true"
      />
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-widest">Aura</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">
        Ask Aura about your spending, budgets, or trends.
      </p>
      <ul className="flex flex-col gap-1.5">
        {STARTER_QUESTIONS.map((q) => (
          <li key={q}>
            <Link
              to="/assistant"
              className="block truncate rounded-lg border border-primary/20 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {q}
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/assistant" className="mt-auto text-left text-sm font-medium text-primary hover:underline">
        Open Aura →
      </Link>
    </div>
  );
}
