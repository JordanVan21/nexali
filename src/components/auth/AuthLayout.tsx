import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/card";
import { BrandMark } from "../BrandMark";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  /** Optional per-page icon chip above the title, matching the reset-password
   * and email-verification references (Sign In/Sign Up don't use one). */
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Shared page shell for every public/auth screen (Sign In, Sign Up, Forgot
 * Password, Reset Password, Email Verification). Deliberately does not
 * render AppNav or the mobile bottom nav: those are authenticated-only
 * navigation and must never appear on a public or recovery page.
 */
export function AuthLayout({ title, subtitle, icon: Icon, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-hero px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="mb-8 flex flex-col items-center gap-3 rounded-lg text-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <BrandMark size="lg" />
        <span className="text-xl font-bold">Nexali</span>
      </Link>

      <Card className="w-full max-w-md border-border/50 bg-gradient-card p-8 shadow-card">
        <div className="mb-6 text-center">
          {Icon && (
            <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
            </span>
          )}
          <h1 className="text-2xl font-bold text-card-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </Card>

      {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
