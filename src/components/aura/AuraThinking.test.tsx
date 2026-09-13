import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuraThinking } from "./AuraThinking";

describe("AuraThinking", () => {
  it("renders an accessible 'thinking' status indicator", () => {
    render(<AuraThinking />);
    expect(screen.getByRole("status", { name: /aura is thinking/i })).toBeInTheDocument();
  });

  it("respects prefers-reduced-motion via the motion-reduce animation guard", () => {
    const { container } = render(<AuraThinking />);
    const dots = container.querySelectorAll(".animate-bounce");
    expect(dots.length).toBeGreaterThan(0);
    dots.forEach((dot) => expect(dot.className).toContain("motion-reduce:animate-none"));
  });
});
