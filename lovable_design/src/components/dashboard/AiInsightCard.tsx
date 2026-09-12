import { Sparkles } from "lucide-react";

export function AiInsightCard({
  headline,
  body,
  ctaLabel,
}: {
  headline: string;
  body: string;
  ctaLabel: string;
}) {
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-5">
      <Sparkles className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 text-primary opacity-10" aria-hidden="true" />
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-widest">{headline}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{body}</p>
      <button
        type="button"
        className="mt-auto text-left text-sm font-medium text-primary hover:underline"
      >
        {ctaLabel} →
      </button>
    </div>
  );
}
