import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Restrained flat primary treatment matching the approved reference
        // (a solid light-blue surface with dark text) plus the real
        // Lovable "brand" glow shadow. Kept as its own variant name so the
        // many existing "hero" call sites (primary CTAs across auth,
        // landing, transactions) didn't need touching to pick up the
        // corrected look.
        hero: "bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-primary-glow)] hover:bg-primary/90 active:scale-[0.98]",
        glow: "bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors",
        // Lovable's real "surface" button treatment: a bordered neutral
        // surface that lifts to a higher tonal step and picks up a primary
        // border on hover, for lower-emphasis actions that still need more
        // visual weight than ghost/outline.
        surface:
          "border border-outline-variant bg-surface-lowest text-foreground hover:border-primary/70 hover:bg-surface-high active:scale-[0.98]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        // Flat h-11 at every breakpoint, matching the real Lovable "control"
        // size exactly -- no large-desktop growth.
        control: "h-11 rounded-lg px-4",
        icon: "h-9 w-9",
        "icon-lg": "h-11 w-11 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
