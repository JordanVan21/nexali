import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "../../lib/utils";

export type StatusVariant = "success" | "warning" | "error" | "info";

const VARIANT_CONFIG: Record<
  StatusVariant,
  { icon: typeof CheckCircle2; className: string; role: "status" | "alert" }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-success/30 bg-success/10 text-success",
    role: "status",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-warning/30 bg-warning/10 text-warning",
    role: "alert",
  },
  error: {
    icon: XCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    role: "alert",
  },
  info: {
    icon: Info,
    className: "border-primary/30 bg-primary/10 text-primary",
    role: "status",
  },
};

type StatusBannerProps = {
  variant: StatusVariant;
  children: ReactNode;
  className?: string;
};

/**
 * Small accessible inline status message. Icon and border/background color
 * are paired with the message text so status is never conveyed by color
 * alone. Use for transient confirmations and warnings; use ErrorState for a
 * whole section or page that failed to load.
 */
export function StatusBanner({ variant, children, className }: StatusBannerProps) {
  const { icon: Icon, className: variantClassName, role } = VARIANT_CONFIG[variant];

  return (
    <div
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", variantClassName, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-medium leading-snug text-foreground">{children}</span>
    </div>
  );
}
