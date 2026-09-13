import { useState } from "react";

export type AuraMessageRole = "user" | "assistant";

export type AuraMessageData = {
  id: string;
  role: AuraMessageRole;
  text: string;
  timestamp: string;
  /**
   * True for a system status notice (e.g. "backend not connected yet"),
   * rendered distinctly from a real Aura reply so it never reads as a
   * fabricated answer. Undefined/false for a normal message.
   */
  isSystemNotice?: boolean;
};

export const AURA_NOT_CONNECTED_MESSAGE =
  "Aura is being connected to your financial data. Chat functionality will be available soon.";

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * Owns the Aura conversation's visual state only — no network call, no AI
 * provider, no fabricated reply. Submitting a message shows it as a real
 * user bubble, then appends one honest system notice explaining that Aura
 * isn't connected yet.
 *
 * Deliberately shaped to match what a future backend-backed version will
 * need (`messages`, `isLoading`, `error`, `submitMessage`) so that wiring
 * this up to a real authenticated Edge Function later only needs to change
 * this hook's internals — not the page or any Aura* component.
 */
export function useAuraConversation() {
  const [messages, setMessages] = useState<AuraMessageData[]>([]);

  const submitMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const now = new Date();
    const userMessage: AuraMessageData = {
      id: `u-${now.getTime()}`,
      role: "user",
      text: trimmed,
      timestamp: formatTimestamp(now),
    };
    const notice: AuraMessageData = {
      id: `n-${now.getTime()}`,
      role: "assistant",
      text: AURA_NOT_CONNECTED_MESSAGE,
      timestamp: formatTimestamp(now),
      isSystemNotice: true,
    };

    setMessages((list) => [...list, userMessage, notice]);
  };

  return {
    messages,
    /** Always false today — no request is ever in flight. Kept so a future backend swap doesn't change this hook's shape. */
    isLoading: false,
    /** Always null today — there is no real request that can fail yet. */
    error: null as string | null,
    submitMessage,
  };
}
