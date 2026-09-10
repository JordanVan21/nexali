import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders its children as an accessible button", () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Save changes</Button>);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Save changes
      </Button>
    );

    const button = screen.getByRole("button", { name: /save changes/i });
    expect(button).toBeDisabled();

    await user.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });
});
