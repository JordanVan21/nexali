import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type FocusedHeaderProps = {
  title: string;
  /** "back" for a step within a flow, "close" for dismissing a standalone task. */
  dismiss: { mode: "back" | "close"; onDismiss: () => void; label?: string };
  /** Optional trailing action, e.g. a "Save" or "Delete" button. */
  action?: ReactNode;
  className?: string;
};

/**
 * Reusable header for focused mobile-first tasks: full-screen forms
 * (Add/Edit Transaction, Add/Edit Budget) and destructive flows (Change
 * Password, Delete Account). Not wired into any flow yet; those are built
 * in later phases as full-screen Dialogs, which naturally sit above the
 * mobile bottom nav so no separate "hide bottom nav" mechanism is needed.
 */
export function FocusedHeader({ title, dismiss, action, className }: FocusedHeaderProps) {
  const DismissIcon = dismiss.mode === "back" ? ArrowLeft : X;
  const dismissLabel = dismiss.label ?? (dismiss.mode === "back" ? "Back" : "Close");

  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between gap-2 border-b border-outline-variant/40 bg-gradient-card px-3 pt-safe",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={dismissLabel}
        onClick={dismiss.onDismiss}
      >
        <DismissIcon className="h-5 w-5" aria-hidden="true" />
      </Button>
      <h2 className="flex-1 truncate text-center text-base font-semibold text-foreground">
        {title}
      </h2>
      <div className="flex min-w-[2.5rem] justify-end">{action}</div>
    </header>
  );
}
