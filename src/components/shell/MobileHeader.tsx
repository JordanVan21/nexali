import { Link } from "react-router-dom";
import { BrandMark } from "../BrandMark";
import { MobileProfileMenu } from "./MobileProfileMenu";

/**
 * Compact app-style top bar shown on every authenticated mobile page (below
 * md): brand mark on the left (matching the desktop nav's logo, linking
 * home), profile/account menu on the right. Notifications and Settings are
 * intentionally not shown here as standalone icons — they live inside the
 * avatar menu on phone widths, so there is exactly one control per
 * destination instead of duplicating icons across the header and menu.
 */
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-[var(--mobile-header-height)] items-center justify-between border-b border-outline-variant/40 bg-gradient-card px-3 shadow-card backdrop-blur-md pt-safe md:hidden">
      <Link
        to="/dashboard"
        aria-label="Nexali home"
        className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <BrandMark tone="solid" size="sm" />
        <span className="truncate text-base font-bold text-foreground">Nexali</span>
      </Link>

      <MobileProfileMenu />
    </header>
  );
}
