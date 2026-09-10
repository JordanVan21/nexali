import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

type PageLoadingProps = {
  /** Accessible label announced while the section is loading. */
  label?: string;
  className?: string;
};

/**
 * Full-section loading state. Used when no shell content can render yet
 * (for example the initial auth check). Once inside a page, prefer
 * section-level Skeletons sized to their loaded content instead.
 */
export function PageLoading({ label = "Loading", className }: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex min-h-[40vh] w-full items-center justify-center py-16", className)}
    >
      <span className="sr-only">{label}</span>
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary motion-reduce:animate-none"
      />
    </div>
  );
}
