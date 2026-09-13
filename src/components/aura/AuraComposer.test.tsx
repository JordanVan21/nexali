import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuraComposer } from "./AuraComposer";

function Wrapper({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState("");
  return <AuraComposer value={value} onValueChange={setValue} onSend={onSend} />;
}

describe("AuraComposer", () => {
  it("accepts typed text", async () => {
    const user = userEvent.setup();
    render(<Wrapper onSend={vi.fn()} />);

    const input = screen.getByLabelText(/ask aura anything about your finances/i);
    await user.type(input, "Hello");
    expect(input).toHaveValue("Hello");
  });

  it("disables Send when the input is empty", () => {
    render(<Wrapper onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
  });

  it("enables Send once there is text, and submits the trimmed value", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<Wrapper onSend={onSend} />);

    await user.type(screen.getByLabelText(/ask aura anything about your finances/i), "  Hi Aura  ");
    const sendButton = screen.getByRole("button", { name: /send message/i });
    expect(sendButton).toBeEnabled();

    await user.click(sendButton);
    expect(onSend).toHaveBeenCalledWith("Hi Aura");
  });

  it("submits on Enter within the form", async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<Wrapper onSend={onSend} />);

    const input = screen.getByLabelText(/ask aura anything about your finances/i);
    await user.type(input, "Question{Enter}");
    expect(onSend).toHaveBeenCalledWith("Question");
  });

  it("shows a truthful not-connected caption instead of implying a live AI is responding", () => {
    render(<Wrapper onSend={vi.fn()} />);
    expect(screen.getByText(/isn't connected to your financial data yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/can make mistakes/i)).not.toBeInTheDocument();
  });
});
