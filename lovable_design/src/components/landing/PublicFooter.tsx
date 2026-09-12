import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

import { landingFooterColumns } from "@/mock/landing";

export function PublicFooter() {
  return (
    <footer className="border-t border-outline-variant bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Wallet className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-display text-lg font-bold text-foreground">Nexali</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Clarity for your money — transactions, budgets and reports in one place, with Aura
              ready to help you make sense of it all.
            </p>
          </div>

          {landingFooterColumns.map((column) => (
            <div key={column.title} className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-outline-variant pt-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Nexali Inc. All rights reserved.</p>
          <p>Your privacy is our priority — data stays encrypted end to end.</p>
        </div>
      </div>
    </footer>
  );
}
