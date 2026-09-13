import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import Notifications from "./Notifications";

describe("Notifications page", () => {
  it("renders the page heading", () => {
    renderWithProviders(<Notifications />);
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
  });

  it("shows a real, non-fabricated unread count of 0 since no notification backend exists", () => {
    renderWithProviders(<Notifications />);
    expect(screen.getByText("0 unread notifications")).toBeInTheDocument();
  });

  it("shows a truthful empty state instead of fake production notifications", () => {
    renderWithProviders(<Notifications />);
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it("never renders Lovable's mock notification content", () => {
    renderWithProviders(<Notifications />);

    expect(screen.queryByText(/dining & takeout/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/new device sign-in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/direct deposit received/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/password changed successfully/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aura found a savings opportunity/i)).not.toBeInTheDocument();
  });

  it("disables Mark all as read since there are no real unread notifications", () => {
    renderWithProviders(<Notifications />);
    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeDisabled();
  });

  it("renders the real All/Unread/category filter tabs operating on an empty array", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Notifications />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["All", "Unread", "Financial", "Security", "System", "Assistant"]);

    await user.click(screen.getByRole("tab", { name: "Unread" }));
    expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument();
    expect(screen.getByText(/no unread notifications right now/i)).toBeInTheDocument();
  });

  it("does not render any notification list items", () => {
    renderWithProviders(<Notifications />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("does not render day-grouping headings when there are no notifications", () => {
    renderWithProviders(<Notifications />);
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(screen.queryByText("Yesterday")).not.toBeInTheDocument();
    expect(screen.queryByText("Earlier")).not.toBeInTheDocument();
  });
});
