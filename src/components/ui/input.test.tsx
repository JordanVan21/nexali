import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";
import { Label } from "./label";

describe("Input", () => {
  it("is reachable by its associated accessible label", () => {
    render(
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" />
      </div>
    );

    const input = screen.getByLabelText(/email/i);
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("reflects what the user types", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" />
      </div>
    );

    const input = screen.getByLabelText(/email/i);
    await user.type(input, "jane@example.com");

    expect(input).toHaveValue("jane@example.com");
  });

  it("respects the disabled attribute", () => {
    render(
      <div>
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" disabled />
      </div>
    );

    expect(screen.getByLabelText(/amount/i)).toBeDisabled();
  });
});
