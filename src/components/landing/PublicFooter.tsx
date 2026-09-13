import { Link } from "react-router-dom";
import { landingFooterColumns } from "../../lib/landingContent";
import { BrandMark } from "../BrandMark";

export function PublicFooter() {
  return (
    <footer className="border-t border-outline-variant bg-background">
      <div className="mx-auto max-w-[1700px] px-4 py-12 md:px-8 xl:px-12 xl:py-14">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BrandMark size="sm" className="md:h-7 md:w-7 md:[&_svg]:h-4 md:[&_svg]:w-4" />
              <span className="font-display text-lg font-bold text-foreground md:text-xl">Nexali</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground xl:text-base">
              Clarity for your money — transactions, budgets and reports in one place, with Aura
              ready to help you make sense of it all.
            </p>
          </div>

          {landingFooterColumns.map((column) => (
            <div key={column.title} className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground xl:text-base">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link to={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary xl:text-base">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary xl:text-base">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-outline-variant pt-6 text-xs text-muted-foreground md:flex-row xl:text-sm">
          <p>© {new Date().getFullYear()} Nexali. All rights reserved.</p>
          <p>Your privacy is our priority — data stays encrypted end to end.</p>
        </div>
      </div>
    </footer>
  );
}
