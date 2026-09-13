import * as React from "react";

import { cn } from "../../lib/utils";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "checked" | "value"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Lovable-aligned toggle, hand-rolled with plain button semantics
 * (role="switch") instead of adding the @radix-ui/react-switch dependency --
 * every current call site (Settings notification preferences) renders it
 * disabled, so Radix's drag/keyboard-range handling isn't needed yet. Visual
 * proportions match the real Lovable Switch exactly (h-5 w-9 track, h-4 w-4
 * thumb, translate-x-4 when checked).
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => {
        if (!disabled) onCheckedChange?.(!checked);
      }}
      ref={ref}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      {...props}
    >
      <span
        data-state={checked ? "checked" : "unchecked"}
        className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      />
    </button>
  )
);
Switch.displayName = "Switch";

export { Switch };
