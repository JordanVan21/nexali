import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Aura AI", href: "#aura" },
  { label: "How it works", href: "#how" },
];

export function PublicNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-outline-variant bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:h-[72px] md:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="truncate font-display text-lg font-bold text-foreground">Nexali</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" asChild>
            <Link to="/signin">Sign In</Link>
          </Button>
          <Button variant="brand" asChild>
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-lg"
              className="md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full max-w-xs flex-col bg-surface">
            <SheetHeader>
              <SheetTitle className="font-display">Nexali</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1">
              {navLinks.map((link) => (
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
              <Button variant="brand" asChild onClick={() => setOpen(false)}>
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
