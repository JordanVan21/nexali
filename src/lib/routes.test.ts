import { describe, it, expect } from "vitest";
import {
  desktopPrimaryRoutes,
  mobileBottomNavRoutes,
  mobileMenuPrimaryRoutes,
  mobileMenuSecondaryRoutes,
  isRouteActive,
  isSecondaryRouteActive,
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
