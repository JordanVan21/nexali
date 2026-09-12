import { Plus, MessageCircle, LifeBuoy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuraConversation } from "@/mock/aura";

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNewConversation,
}: {
  conversations: AuraConversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}) {
  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-r border-border bg-surface-lowest md:flex">
      <div className="p-4">
        <Button variant="brand" size="control" className="w-full" onClick={onNewConversation}>
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>
      </div>

      <nav aria-label="Recent conversations" className="flex-1 space-y-1 overflow-y-auto scroll-slim px-3">
        <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
          Recent History
        </p>
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-current={c.id === activeId ? "true" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors",
              c.id === activeId
                ? "border border-outline-variant bg-surface-high"
                : "border border-transparent hover:bg-surface-high/60",
            )}
          >
            <MessageCircle
              className={cn("h-5 w-5 shrink-0", c.id === activeId ? "text-primary" : "text-muted-foreground")}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
              <p className="text-xs text-muted-foreground/70">{c.timeLabel}</p>
            </div>
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-border p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg p-2 text-sm text-muted-foreground transition-colors hover:bg-surface-high"
        >
          <LifeBuoy className="h-5 w-5" aria-hidden />
          Support & Docs
        </button>
      </div>
    </aside>
  );
}
