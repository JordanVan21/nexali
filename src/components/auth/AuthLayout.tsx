import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Landmark } from "lucide-react";
import { Card } from "../ui/card";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Shared page shell for every public/auth screen (Sign In, Sign Up, Forgot
 * Password, Reset Password, Email Verification). Deliberately does not
 * render AppNav or the mobile bottom nav: those are authenticated-only
 * navigation and must never appear on a public or recovery page.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-hero px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="mb-8 flex items-center gap-2 rounded-lg text-lg font-bold text-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Landmark className="h-7 w-7 text-primary" aria-hidden="true" />
        Nexali
      </Link>

      <Card className="w-full max-w-md border-border/50 bg-gradient-card p-8 shadow-card">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-card-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </Card>

      {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
