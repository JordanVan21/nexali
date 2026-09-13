import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuraConversation, AURA_NOT_CONNECTED_MESSAGE } from "./useAuraConversation";

describe("useAuraConversation", () => {
  it("starts with no messages — no seeded/fake conversation", () => {
    const { result } = renderHook(() => useAuraConversation());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("appends a real user message and an honest not-connected notice, never a fabricated answer", () => {
    const { result } = renderHook(() => useAuraConversation());

    act(() => {
      result.current.submitMessage("How much did I spend this month?");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      text: "How much did I spend this month?",
    });
    expect(result.current.messages[0].isSystemNotice).toBeFalsy();
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      text: AURA_NOT_CONNECTED_MESSAGE,
      isSystemNotice: true,
    });
  });

  it("trims whitespace and ignores an empty/whitespace-only submission", () => {
    const { result } = renderHook(() => useAuraConversation());

    act(() => {
      result.current.submitMessage("   ");
    });
    expect(result.current.messages).toHaveLength(0);

    act(() => {
      result.current.submitMessage("  hello  ");
    });
    expect(result.current.messages[0].text).toBe("hello");
  });

  it("never produces a message that isn't the user's own text or the fixed not-connected notice", () => {
    const { result } = renderHook(() => useAuraConversation());
    act(() => {
      result.current.submitMessage("What are my highest-spending categories?");
    });
    for (const m of result.current.messages) {
      if (m.role === "assistant") {
        expect(m.text).toBe(AURA_NOT_CONNECTED_MESSAGE);
      }
    }
  });
});
