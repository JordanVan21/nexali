import { Info, Sparkles } from "lucide-react";
import type { AuraMessageData } from "../../features/aura/useAuraConversation";

/** One message bubble — user, real Aura reply, or a system notice (e.g. "not connected yet"), each styled distinctly. */
export function AuraMessage({ message }: { message: AuraMessageData }) {
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

  if (message.isSystemNotice) {
    return (
      <div className="mx-auto flex max-w-[90%] items-start gap-2 rounded-xl border border-outline-variant/60 bg-surface-low px-4 py-3 text-center sm:max-w-[75%]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-left text-sm text-muted-foreground">{message.text}</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="rounded-2xl rounded-tl-none border border-outline-variant bg-surface-low px-4 py-3">
          <p className="text-sm leading-relaxed text-foreground sm:text-base">{message.text}</p>
        </div>
        <span className="px-2 text-[11px] text-muted-foreground">{message.timestamp}</span>
      </div>
    </div>
  );
}
