import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuraErrorState } from "./AuraErrorState";

describe("AuraErrorState", () => {
  it("renders a user-safe fixture message, never a raw provider/server error", () => {
    render(<AuraErrorState message="Aura couldn't respond right now. The rest of Nexali still works normally." />);
    expect(screen.getByRole("alert")).toHaveTextContent("The rest of Nexali still works normally.");
  });

  it("calls onRetry when the Retry action is used", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<AuraErrorState message="Test error" onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the Retry action when no onRetry is given", () => {
    render(<AuraErrorState message="Test error" />);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });
});
