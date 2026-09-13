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
 * Labeled text input with a leading icon, matching the real Lovable auth
 * field treatment scaled to Nexali's larger approved Auth presence (48-56px
 * tall, larger icon/label/text than Lovable's own literal pixel values).
 * Shared by Sign In / Sign Up / Forgot Password / the verification resend
 * form.
 */
export function TextField({ label, icon: Icon, id, className, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-[15px] text-muted-foreground sm:text-base">
        {label}
      </Label>
      <div className="relative flex items-center">
        <Icon
          className="pointer-events-none absolute left-4 h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          className={cn(
            "h-12 rounded-lg border-outline-variant bg-surface-lowest pl-12 text-base sm:h-14",
            className
          )}
          {...props}
        />
      </div>
    </div>
  );
}
