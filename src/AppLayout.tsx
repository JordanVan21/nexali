import { Outlet } from "react-router-dom";
import { AppNav } from "./components/shell/AppNav";
import { MobileHeader } from "./components/shell/MobileHeader";
import { MobileNav } from "./components/shell/MobileNav";
import { WithErrorBoundary } from "./ErrorBoundary";

/**
 * Authenticated application shell. Renders the desktop/tablet nav and the
 * mobile header + bottom nav together, letting CSS breakpoints (not a JS
 * isMobile check) decide which is visible, so there is no first-render
 * flash of the wrong layout. A single error boundary wraps every route so
 * one crashed page never takes down the nav shell around it.
 */
export default function AppLayout() {
  return (
    <>
      <AppNav />
      <MobileHeader />
      <main className="pb-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))] md:pb-0">
        <WithErrorBoundary>
          <Outlet />
        </WithErrorBoundary>
      </main>
      <MobileNav />
    </>
  );
}
