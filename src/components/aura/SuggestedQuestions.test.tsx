import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { AURA_STARTER_QUESTIONS } from "./auraStarterQuestions";

describe("SuggestedQuestions", () => {
  it("renders every provided question as a chip", () => {
    render(<SuggestedQuestions questions={AURA_STARTER_QUESTIONS} onSelect={vi.fn()} />);
    for (const q of AURA_STARTER_QUESTIONS) {
      expect(screen.getByRole("button", { name: q })).toBeInTheDocument();
    }
  });

  it("calls onSelect with the question's exact text when clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SuggestedQuestions questions={["How is my budget going?"]} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "How is my budget going?" }));
    expect(onSelect).toHaveBeenCalledWith("How is my budget going?");
  });

  it("renders nothing when there are no questions", () => {
    const { container } = render(<SuggestedQuestions questions={[]} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("contains no starter prompt implying a write action", () => {
    const writeVerbs = /\b(add|create|delete|edit|update|change|remove)\b/i;
    for (const q of AURA_STARTER_QUESTIONS) {
      expect(q).not.toMatch(writeVerbs);
    }
  });
});
