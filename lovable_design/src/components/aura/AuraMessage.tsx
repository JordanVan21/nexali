import { ArrowRight, PieChart, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AuraMessage as AuraMessageType } from "@/mock/aura";

const TONE_BAR: Record<string, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

export function AuraMessage({ message }: { message: AuraMessageType }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[85%] rounded-2xl rounded-tr-none border border-outline-variant bg-surface-highest px-4 py-3 sm:max-w-[75%]">
          <p className="text-sm text-foreground sm:text-base">{message.text}</p>
        </div>
        <span className="px-2 text-[11px] text-muted-foreground">{message.timestamp}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="rounded-2xl rounded-tl-none border border-border bg-surface-low px-4 py-3">
          <p className="text-sm leading-relaxed text-foreground sm:text-base">{message.text}</p>
        </div>

        {message.chart && (
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-[var(--shadow-primary-glow)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <PieChart className="h-4 w-4 text-primary" aria-hidden />
                {message.chart.title}
              </span>
              <span className="numeric text-[11px] uppercase text-muted-foreground">
                {message.chart.asOf}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:items-center">
              <div className="relative mx-auto flex aspect-square w-full max-w-[160px] items-center justify-center">
                <div className="absolute inset-0 rounded-full border-[10px] border-outline-variant/20" />
                <div className="absolute inset-0 rotate-45 rounded-full border-[10px] border-primary border-l-transparent border-t-transparent" />
                <div className="text-center">
                  <p className="numeric text-xl font-bold text-foreground">
                    {message.chart.highlightValue}
                  </p>
                  <p className="text-[10px] uppercase tracking-tight text-muted-foreground">
                    {message.chart.highlightLabel}
                  </p>
                </div>
              </div>
              <ul className="space-y-3" aria-label={`${message.chart.title} legend`}>
                {message.chart.legend.map((item) => (
                  <li key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className={cn("h-2.5 w-2.5 rounded-full", TONE_BAR[item.color])} aria-hidden />
                        {item.label}
                      </span>
                      <span className="numeric text-foreground">{item.percent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-outline-variant/20">
                      <div
                        className={cn("h-full rounded-full", TONE_BAR[item.color])}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {message.followUp && (
          <div className="rounded-2xl border border-border bg-surface-low px-4 py-3">
            <p className="text-sm text-foreground sm:text-base">{message.followUp}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AuraTypingIndicator() {
  return (
    <div className="flex items-start gap-3" role="status" aria-label="Aura is typing">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-none border border-border bg-surface-low px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

export function AuraExecuteCta({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      Execute rebalancing plan
      <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  );
}
