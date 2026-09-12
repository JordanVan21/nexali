import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A single grouped-settings row: label/description on the left, a control on
 * the right. Used across Profile, Account and Settings for a consistent
 * app-style settings list on mobile and a two-column layout on desktop.
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  control,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  control: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-4", className)}>
      <div className="min-w-0 pr-2">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        ) : (
          <div className="text-sm font-medium text-foreground">{label}</div>
        )}
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
