import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ConversationList } from "@/components/aura/ConversationList";
import { AuraMessage, AuraTypingIndicator } from "@/components/aura/AuraMessage";
import { SuggestedQuestions } from "@/components/aura/SuggestedQuestions";
import { AuraComposer } from "@/components/aura/AuraComposer";
import {
  mockActiveConversationId,
  mockAuraUser,
  mockCannedReplies,
  mockConversations,
  mockInitialMessages,
  mockSuggestedQuestions,
  type AuraMessage as AuraMessageType,
} from "@/mock/aura";

const title = "Aura — Nexali";
const description = "Chat with Aura, your Nexali AI financial co-pilot, about spending and cash flow.";

export const Route = createFileRoute("/aura")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuraPage,
});

let replyCursor = 0;

function AuraPage() {
  const [messages, setMessages] = useState<AuraMessageType[]>(mockInitialMessages);
  const [activeConversationId, setActiveConversationId] = useState(mockActiveConversationId);
  const [composerValue, setComposerValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    const userMessage: AuraMessageType = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
    setMessages((list) => [...list, userMessage]);
    setIsTyping(true);

    window.setTimeout(() => {
      const reply = mockCannedReplies[replyCursor % mockCannedReplies.length]!;
      replyCursor += 1;
      const assistantMessage: AuraMessageType = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: reply,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      };
      setIsTyping(false);
      setMessages((list) => [...list, assistantMessage]);
    }, 1200);
  };

  const handleNewConversation = () => {
    setMessages([]);
    setActiveConversationId("");
  };

  return (
    <AppShell
      activeKey="aura"
      mainClassName="flex flex-col overflow-hidden pt-[calc(3.5rem+env(safe-area-inset-top,0px))] pb-0 md:pt-16"
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ConversationList
          conversations={mockConversations}
          activeId={activeConversationId}
          onSelect={setActiveConversationId}
          onNewConversation={handleNewConversation}
        />

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto scroll-slim px-4 py-6 sm:px-6"
            aria-live="polite"
            aria-relevant="additions"
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                    <Sparkles className="h-8 w-8" aria-hidden />
                  </span>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Hello, {mockAuraUser.firstName}. I'm Aura.
                  </h2>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Your Nexali financial co-pilot. How can I help you optimize your money today?
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <AuraMessage key={message.id} message={message} />
              ))}

              {isTyping && <AuraTypingIndicator />}
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-background px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-6 md:pb-6">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              <SuggestedQuestions questions={mockSuggestedQuestions} onSelect={setComposerValue} />
              <AuraComposer
                value={composerValue}
                onValueChange={setComposerValue}
                onSend={sendMessage}
                disabled={isTyping}
              />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
