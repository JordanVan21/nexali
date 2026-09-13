import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { BrandMark } from "../BrandMark";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Aura AI", href: "#aura" },
  { label: "How it works", href: "#how" },
];

/**
 * Header for public (unauthenticated) pages, currently just the Landing
 * page. Intentionally separate from AppNav: it must never expose
 * authenticated destinations (Transactions, Budgets, Reports, Aura,
 * notifications, settings, the account menu), so it is not a stripped-down
 * reuse of that component but its own small, public-only nav.
 */
export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-outline-variant bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1700px] items-center justify-between gap-4 px-4 md:h-[72px] md:px-8 xl:h-20 xl:px-12">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <BrandMark
            size="sm"
            className="md:h-7 md:w-7 xl:h-8 xl:w-8 md:[&_svg]:h-4 md:[&_svg]:w-4 xl:[&_svg]:h-[18px] xl:[&_svg]:w-[18px]"
          />
          <span className="truncate font-display text-lg font-bold text-foreground md:text-xl xl:text-2xl">
            Nexali
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary lg:text-base xl:text-[17px]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" asChild className="lg:h-10 lg:px-5 lg:text-base xl:text-[17px]">
            <Link to="/signin">Sign In</Link>
          </Button>
          <Button variant="hero" asChild className="lg:h-10 lg:px-5 lg:text-base xl:text-[17px]">
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-lg" className="md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full max-w-xs flex-col">
            <SheetHeader>
              <SheetTitle className="font-display">Nexali</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface-high"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3 pb-safe">
              <Button variant="surface" asChild onClick={() => setOpen(false)}>
                <Link to="/signin">Sign In</Link>
              </Button>
              <Button variant="hero" asChild onClick={() => setOpen(false)}>
                <Link to="/signup">Get Started</Link>
              </Button>
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                View demo
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
