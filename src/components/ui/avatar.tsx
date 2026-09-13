import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Minimal Avatar/AvatarImage/AvatarFallback set matching the real Lovable
 * visual result without the @radix-ui/react-avatar dependency: callers
 * already know synchronously (from real query data) whether a real avatar
 * URL exists, so there's no need for Radix's own image-load detection --
 * just render the image or the fallback, whichever applies.
 */
const Avatar = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn("relative flex shrink-0 overflow-hidden rounded-full", className)} {...props} />
  )
);
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  ({ className, ...props }, ref) => (
    <img ref={ref} className={cn("aspect-square h-full w-full object-cover", className)} {...props} />
  )
);
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn("flex h-full w-full items-center justify-center rounded-full", className)}
      {...props}
    />
  )
);
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
