import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  icon: LucideIcon;
  id?: string;
};

/**
 * Labeled text input with a leading icon (matching the approved auth
 * references, where every field carries a leading glyph inside the input).
 * Shared by Sign In / Sign Up / Forgot Password / the verification resend
 * form so the icon-input treatment isn't hand-rolled per page.
 */
export function TextField({ label, icon: Icon, id, className, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div>
      <Label htmlFor={inputId} className="text-card-foreground">
        {label}
      </Label>
      <div className="relative mt-2">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input id={inputId} className={cn("pl-10", className)} {...props} />
      </div>
    </div>
  );
}
