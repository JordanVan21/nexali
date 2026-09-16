import { Outlet } from "react-router-dom";
import { AppNav } from "./components/shell/AppNav";
import { MobileHeader } from "./components/shell/MobileHeader";
import { MobileNav } from "./components/shell/MobileNav";
import { WithErrorBoundary } from "./ErrorBoundary";
import { FormatPreferencesProvider } from "./features/profiles/FormatPreferencesContext";

/**
 * Authenticated application shell. Renders the desktop/tablet nav and the
 * mobile header + bottom nav together, letting CSS breakpoints (not a JS
 * isMobile check) decide which is visible, so there is no first-render
 * flash of the wrong layout. A single error boundary wraps every route so
 * one crashed page never takes down the nav shell around it.
 *
 * FormatPreferencesProvider is mounted once here (inside AuthGate, so
 * useUserInfo is safe) so every page/component below can read the caller's
 * real persisted currency/number/date-format/timezone preferences via
 * useFormatPreferences()/useFormatCurrency()/useFormatDate() without each
 * one subscribing to its own useProfile() call -- see Backend Part 6.
 *
 * No custom Friends context/provider exists (Backend Part 8 removed the
 * frontend-only one from the earlier phase) -- AppNav/MobileHeader's
 * Friends badge and the Friends page itself now share state the same way
 * the Notifications badge always has: a real TanStack Query cache entry
 * (qk.friendsIncomingCount), which every subscriber reads from and every
 * relevant mutation invalidates. No extra plumbing needed here.
 */
export default function AppLayout() {
  return (
    <FormatPreferencesProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <AppNav />
        <MobileHeader />
        <main className="flex-1 pb-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))] md:pb-0">
          <WithErrorBoundary>
            <Outlet />
          </WithErrorBoundary>
        </main>
        <MobileNav />
      </div>
    </FormatPreferencesProvider>
  );
}
