import { describe, it, expect } from "vitest";
import {
  desktopPrimaryRoutes,
  mobileBottomNavRoutes,
  isRouteActive,
  getSafeRedirectPath,
  findRouteByPath,
  NAV_ROUTES,
} from "./routes";

describe("routes", () => {
  it("orders the desktop primary nav as Dashboard, Transactions, Budgets, Reports, Aura", () => {
    expect(desktopPrimaryRoutes.map((r) => r.label)).toEqual([
      "Dashboard",
      "Transactions",
      "Budgets",
      "Reports",
      "Aura",
    ]);
  });

  it("orders the mobile bottom nav as Dashboard, Transactions, Budgets, Reports, Aura", () => {
    expect(mobileBottomNavRoutes.map((r) => r.label)).toEqual([
      "Dashboard",
      "Transactions",
      "Budgets",
      "Reports",
      "Aura",
    ]);
  });

  it("mirrors the desktop primary set exactly in the mobile bottom nav (no More tab)", () => {
    expect(mobileBottomNavRoutes.map((r) => r.path)).toEqual(
      desktopPrimaryRoutes.map((r) => r.path)
    );
  });

  it("does not include Notifications, Profile, Account, Settings, Split Expenses, or Friends in the bottom nav", () => {
    const labels = mobileBottomNavRoutes.map((r) => r.label);
    for (const excluded of ["Notifications", "Profile", "Account", "Settings", "Split Expenses", "Friends"]) {
      expect(labels).not.toContain(excluded);
    }
  });

  it("registers Split Expenses and Friends as real, non-primary routes (deliberately not crowding the five-item primary nav)", () => {
    const split = findRouteByPath("/split");
    const friends = findRouteByPath("/friends");

    expect(split?.label).toBe("Split Expenses");
    expect(split?.desktopPrimary).toBe(false);
    expect(split?.mobileBottomNav).toBe(false);

    expect(friends?.label).toBe("Friends");
    expect(friends?.desktopPrimary).toBe(false);
    expect(friends?.mobileBottomNav).toBe(false);

    expect(desktopPrimaryRoutes.map((r) => r.label)).not.toContain("Split Expenses");
    expect(desktopPrimaryRoutes.map((r) => r.label)).not.toContain("Friends");
  });

  it("keeps every existing route present in NAV_ROUTES (nothing renamed or removed)", () => {
    const labels = NAV_ROUTES.map((r) => r.label);
    for (const existing of ["Dashboard", "Transactions", "Budgets", "Reports", "Aura", "Notifications", "Profile", "Account", "Settings"]) {
      expect(labels).toContain(existing);
    }
  });

  it("gives Dashboard and Transactions a tablet short label, and leaves the rest unset", () => {
    const byLabel = Object.fromEntries(desktopPrimaryRoutes.map((r) => [r.label, r.shortLabel]));
    expect(byLabel["Dashboard"]).toBe("Home");
    expect(byLabel["Transactions"]).toBe("Activity");
    expect(byLabel["Budgets"]).toBeUndefined();
    expect(byLabel["Reports"]).toBeUndefined();
    expect(byLabel["Aura"]).toBeUndefined();
  });

  it("matches active routes by exact pathname", () => {
    expect(isRouteActive("/dashboard", "/dashboard")).toBe(true);
    expect(isRouteActive("/dashboard", "/budgets")).toBe(false);
  });
});

describe("getSafeRedirectPath", () => {
  it("accepts a plain internal path", () => {
    expect(getSafeRedirectPath("/transactions")).toBe("/transactions");
  });

  it("accepts an internal path with a query string", () => {
    expect(getSafeRedirectPath("/transactions?month=3")).toBe("/transactions?month=3");
  });

  it("falls back to /dashboard when no candidate is given", () => {
    expect(getSafeRedirectPath(null)).toBe("/dashboard");
    expect(getSafeRedirectPath(undefined)).toBe("/dashboard");
    expect(getSafeRedirectPath("")).toBe("/dashboard");
  });

  it("uses a custom fallback when provided", () => {
    expect(getSafeRedirectPath(null, "/somewhere-else")).toBe("/somewhere-else");
  });

  it("rejects an absolute external URL", () => {
    expect(getSafeRedirectPath("https://malicious-site.example")).toBe("/dashboard");
  });

  it("rejects a protocol-relative external URL", () => {
    expect(getSafeRedirectPath("//malicious-site.example")).toBe("/dashboard");
  });

  it("rejects a javascript: scheme", () => {
    expect(getSafeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects a backslash-prefixed target", () => {
    expect(getSafeRedirectPath("/\\malicious-site.example")).toBe("/dashboard");
  });
});
