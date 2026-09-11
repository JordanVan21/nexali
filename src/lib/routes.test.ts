import { describe, it, expect } from "vitest";
import {
  desktopPrimaryRoutes,
  mobileBottomNavRoutes,
  mobileMenuPrimaryRoutes,
  mobileMenuSecondaryRoutes,
  isRouteActive,
  isSecondaryRouteActive,
  getSafeRedirectPath,
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

  it("orders the mobile bottom nav as Dashboard, Transactions, Budgets, Aura", () => {
    expect(mobileBottomNavRoutes.map((r) => r.label)).toEqual([
      "Dashboard",
      "Transactions",
      "Budgets",
      "Aura",
    ]);
  });

  it("does not include Reports, Notifications, Profile, Account, or Settings in the bottom nav", () => {
    const labels = mobileBottomNavRoutes.map((r) => r.label);
    for (const excluded of ["Reports", "Notifications", "Profile", "Account", "Settings"]) {
      expect(labels).not.toContain(excluded);
    }
  });

  it("groups the mobile menu into the same primary set as desktop, plus a secondary set", () => {
    expect(mobileMenuPrimaryRoutes.map((r) => r.label)).toEqual(
      desktopPrimaryRoutes.map((r) => r.label)
    );
    expect(mobileMenuSecondaryRoutes.map((r) => r.label)).toEqual([
      "Notifications",
      "Profile",
      "Account",
      "Settings",
    ]);
  });

  it("matches active routes by exact pathname", () => {
    expect(isRouteActive("/dashboard", "/dashboard")).toBe(true);
    expect(isRouteActive("/dashboard", "/budgets")).toBe(false);
  });

  it("treats Reports, Notifications, Profile, Account, and Settings as secondary (More) routes", () => {
    for (const path of ["/reports", "/notifications", "/profile", "/account", "/settings"]) {
      expect(isSecondaryRouteActive(path)).toBe(true);
    }
  });

  it("does not treat a bottom-nav route as secondary", () => {
    for (const path of ["/dashboard", "/transactions", "/budgets", "/assistant"]) {
      expect(isSecondaryRouteActive(path)).toBe(false);
    }
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
