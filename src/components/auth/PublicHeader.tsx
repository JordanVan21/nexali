import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "../ui/button";
import { BrandMark } from "../BrandMark";

/**
 * Header for public (unauthenticated) pages, currently just the Landing
 * page. Intentionally separate from AppNav: it must never expose
 * authenticated destinations (Transactions, Budgets, Reports, Aura,
 * notifications, settings, the account menu), so it is not a stripped-down
 * reuse of that component but its own small, public-only nav.
 */
export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-gradient-card/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-lg text-lg font-bold text-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <BrandMark size="sm" />
          Nexali
        </Link>

        <div className="hidden items-center gap-2 sm:flex">
          <Button asChild variant="ghost">
            <Link to="/signin">Sign In</Link>
          </Button>
          <Button asChild variant="hero">
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        >
          {menuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-primary/10 bg-gradient-card px-4 py-3 sm:hidden">
          <div className="flex flex-col gap-2">
            <Button asChild variant="ghost" className="justify-center" onClick={() => setMenuOpen(false)}>
              <Link to="/signin">Sign In</Link>
            </Button>
            <Button asChild variant="hero" className="justify-center" onClick={() => setMenuOpen(false)}>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
