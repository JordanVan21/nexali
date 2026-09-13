import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../BrandMark";
import { cn } from "../../lib/utils";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Narrower cards (Sign In, Forgot/Reset Password, Verify Email) use the
   * default; Sign Up gets a touch more room for its extra fields. */
  maxWidthClassName?: string;
};

/**
 * Shared page shell for every public/auth screen (Sign In, Sign Up, Forgot
 * Password, Reset Password, Email Verification). Deliberately does not
 * render AppNav or the mobile bottom nav: those are authenticated-only
 * navigation and must never appear on a public or recovery page.
 *
 * Matches the real Lovable auth reference: a single brand icon above the
 * heading (no separate small wordmark label stacked underneath it, which
 * previously created an extra hierarchy level Lovable's own pages don't
 * have) -- the page's own h1 carries the brand/page identity instead, at
 * Lovable's full desktop scale.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  maxWidthClassName = "max-w-[520px]",
}: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6 sm:py-16">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-[110px]" />
        <div className="absolute bottom-0 right-0 h-[32rem] w-[32rem] rounded-full bg-success/10 blur-[130px]" />
      </div>

      <div className={cn("relative z-10 w-full", maxWidthClassName)}>
        <div className="mb-9 flex flex-col items-center text-center">
          <Link
            to="/"
            aria-label="Nexali home"
            className="mb-6 rounded-lg text-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <BrandMark size="lg" />
          </Link>
          <h1 className="font-display text-[32px] font-semibold tracking-tight text-foreground sm:text-[42px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-md text-[17px] leading-relaxed text-muted-foreground sm:text-[19px]">
              {subtitle}
            </p>
          )}
        </div>

        <div className="nexali-panel rounded-2xl p-7 shadow-2xl sm:p-10">{children}</div>

        {footer && (
          <div className="mt-10 text-center text-[15px] text-muted-foreground sm:text-base">{footer}</div>
        )}
      </div>
    </div>
  );
}
