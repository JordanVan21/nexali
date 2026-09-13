import { useState } from "react";
import { AuraMessageList } from "../components/aura/AuraMessageList";
import { AuraComposer } from "../components/aura/AuraComposer";
import { SuggestedQuestions } from "../components/aura/SuggestedQuestions";
import { AURA_STARTER_QUESTIONS } from "../components/aura/auraStarterQuestions";
import { useAuraConversation } from "../features/aura/useAuraConversation";
import { useProfile } from "../features/profiles/useProfile";
import { useUserInfo } from "../shared/useUserId";

/**
 * Aura's real page shell. The conversation itself is frontend-only for now
 * (see useAuraConversation.ts) — there is no AI provider, no Edge Function
 * call, and no fabricated reply. Real profile data is used only for the
 * cosmetic greeting and is never required to render the page.
 */
export default function Assistant() {
  const { userId } = useUserInfo();
  const profile = useProfile(userId);
  const { messages, isLoading, error, submitMessage } = useAuraConversation();
  const [composerValue, setComposerValue] = useState("");

  const firstName = profile.data?.full_name?.split(" ")[0];

  const handleSend = (text: string) => {
    submitMessage(text);
    setComposerValue("");
  };

  return (
    <div
      className="flex min-h-[calc(100dvh-var(--mobile-header-height)-var(--mobile-nav-height)-env(safe-area-inset-bottom))] flex-col md:min-h-[calc(100dvh-var(--desktop-nav-height))] xl:min-h-[calc(100dvh-var(--desktop-nav-height-xl))] 2xl:min-h-[calc(100dvh-var(--desktop-nav-height-2xl))]"
    >
      <h1 className="sr-only">Aura</h1>

      <AuraMessageList messages={messages} isLoading={isLoading} error={error} firstName={firstName} />

      <div className="shrink-0 border-t border-outline-variant bg-background px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <SuggestedQuestions questions={AURA_STARTER_QUESTIONS} onSelect={setComposerValue} />
          <AuraComposer value={composerValue} onValueChange={setComposerValue} onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
