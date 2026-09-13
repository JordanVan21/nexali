import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuraMessage } from "./AuraMessage";
import type { AuraMessageData } from "../../features/aura/useAuraConversation";

describe("AuraMessage", () => {
  it("renders a user message right-aligned with its timestamp", () => {
    const message: AuraMessageData = { id: "1", role: "user", text: "Hello Aura", timestamp: "10:00 AM" };
    render(<AuraMessage message={message} />);

    expect(screen.getByText("Hello Aura")).toBeInTheDocument();
    expect(screen.getByText("10:00 AM")).toBeInTheDocument();
  });

  it("renders a real Aura reply with the Aura identity", () => {
    const message: AuraMessageData = { id: "2", role: "assistant", text: "Here is your answer.", timestamp: "10:01 AM" };
    const { container } = render(<AuraMessage message={message} />);

    expect(screen.getByText("Here is your answer.")).toBeInTheDocument();
    expect(container.querySelector(".lucide-sparkles")).toBeInTheDocument();
  });

  it("renders a system notice distinctly, without the Aura sparkle identity", () => {
    const message: AuraMessageData = {
      id: "3",
      role: "assistant",
      text: "Aura is being connected to your financial data. Chat functionality will be available soon.",
      timestamp: "10:02 AM",
      isSystemNotice: true,
    };
    const { container } = render(<AuraMessage message={message} />);

    expect(screen.getByText(/being connected to your financial data/i)).toBeInTheDocument();
    expect(container.querySelector(".lucide-sparkles")).not.toBeInTheDocument();
  });
});
