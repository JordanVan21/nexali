import { cn } from "../../lib/utils";

const STEPS = ["Receipts", "Assign", "Preview"] as const;
export type SplitStep = (typeof STEPS)[number];

/**
 * Subtle progress indicator only -- not a wizard. Every step's content
 * stays reachable without forcing separate pages/routes (Preview is a
 * mode within this same page, not a navigation). Purely decorative/
 * informational, so it's a non-interactive list with the current step
 * marked via aria-current="step" for assistive tech.
 */
export function SplitStepIndicator({ current }: { current: SplitStep }) {
  return (
    <ol aria-label="Split Expenses progress" className="flex items-center gap-1 rounded-xl bg-surface-low p-1 text-sm">
      {STEPS.map((step, i) => {
        const active = step === current;
        return (
          <li key={step} className="flex items-center">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition-colors",
                active ? "bg-surface-high text-foreground" : "text-muted-foreground"
              )}
            >
              {step}
            </span>
            {i < STEPS.length - 1 && <span aria-hidden="true" className="px-1 text-muted-foreground/50">›</span>}
          </li>
        );
      })}
    </ol>
  );
}
