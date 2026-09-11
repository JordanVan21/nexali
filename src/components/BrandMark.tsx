import { Landmark } from "lucide-react";
import { cn } from "../lib/utils";

type BrandMarkProps = {
  /** "solid" (filled primary chip, dark icon) for the authenticated app shell,
   * matching navigation/navbar-desktop.png. "outline" (dark chip, primary
   * icon) for public/marketing surfaces, matching the landing and auth
   * references. Both appear in the approved Stitch export; this keeps each
   * context faithful to its own reference instead of forcing one everywhere. */
  tone?: "solid" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: { box: "h-6 w-6", icon: "h-3.5 w-3.5" },
  md: { box: "h-8 w-8", icon: "h-5 w-5" },
  lg: { box: "h-14 w-14", icon: "h-8 w-8" },
};

/** Nexali's brand icon chip, shared by the authenticated nav, the public header, and auth pages. */
export function BrandMark({ tone = "outline", size = "md", className }: BrandMarkProps) {
  const { box, icon } = SIZES[size];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        box,
        tone === "solid" ? "bg-primary" : "border border-border/60 bg-card",
        className
      )}
    >
      <Landmark
        className={cn(icon, tone === "solid" ? "text-primary-foreground" : "text-primary")}
        aria-hidden="true"
      />
    </span>
  );
}
