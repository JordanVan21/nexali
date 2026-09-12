import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  className?: string | undefined;
  maxWidthClassName?: string | undefined;
}

export function AuthLayout({
  title,
  description,
  children,
  footer,
  className,
  maxWidthClassName = "max-w-[440px]",
}: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-success/5 blur-[120px]" />
      </div>

      <div className={`relative z-10 w-full ${maxWidthClassName}`}>
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            to="/"
            className="mb-4 flex items-center justify-center rounded-xl border border-outline-variant bg-surface-high p-3 shadow-lg transition-colors hover:border-primary/60"
            aria-label="Nexali home"
          >
            <Sparkles className="h-7 w-7 text-primary" aria-hidden="true" />
          </Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[32px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div className={`nexali-panel rounded-2xl p-6 shadow-2xl sm:p-8 ${className ?? ""}`}>
          {children}
        </div>

        {footer ? <div className="mt-8 text-center">{footer}</div> : null}
      </div>
    </div>
  );
}
