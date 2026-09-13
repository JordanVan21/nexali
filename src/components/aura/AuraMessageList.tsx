import { useEffect, useRef } from "react";
import { AuraMessage } from "./AuraMessage";
import { AuraThinking } from "./AuraThinking";
import { AuraErrorState } from "./AuraErrorState";
import { AuraEmptyState } from "./AuraEmptyState";
import type { AuraMessageData } from "../../features/aura/useAuraConversation";

/**
 * Scrollable conversation surface. Shaped to accept `messages`/`isLoading`/`error`
 * so a future backend-connected version only changes what's passed in, not
 * this component (see useAuraConversation.ts).
 */
export function AuraMessageList({
  messages,
  isLoading,
  error,
  firstName,
  onRetry,
}: {
  messages: AuraMessageData[];
  isLoading: boolean;
  error: string | null;
  firstName?: string;
  onRetry?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div ref={scrollRef} className="scroll-slim flex-1 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite" aria-relevant="additions">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {messages.length === 0 && !isLoading && !error && <AuraEmptyState firstName={firstName} />}

        {messages.map((message) => (
          <AuraMessage key={message.id} message={message} />
        ))}

        {isLoading && <AuraThinking />}
        {error && <AuraErrorState message={error} onRetry={onRetry} />}
      </div>
    </div>
  );
}
