import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { CONTENT_MAX_WIDTH_CLASS, CONTENT_PADDING_CLASS } from "./containerWidth";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  /** Escape hatch for a page that needs edge-to-edge content instead of the constrained width. */
  fullWidth?: boolean;
};

/**
 * Shared outer spacing for every authenticated page: responsive horizontal
 * padding, vertical rhythm, and a constrained max-width on large screens.
 * Pages should use this instead of inventing their own outer spacing.
 *
 * Clearance for the fixed mobile bottom nav is handled once, shell-wide, by
 * AppLayout's <main> wrapper, not here, so every route is protected even
 * before it adopts this container.
 */
export function PageContainer({ children, className, fullWidth = false }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full py-6 lg:py-8",
        CONTENT_PADDING_CLASS,
        !fullWidth && CONTENT_MAX_WIDTH_CLASS,
        className
      )}
    >
      {children}
    </div>
  );
}
