import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { getPasswordStrength } from "../../lib/passwordStrength";

type PasswordFieldProps = {
  label: string;
  /** Optional content rendered inline with the label, for example a "Forgot password?" link. */
  labelExtra?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  invalid?: boolean;
  errorMessage?: string;
  id?: string;
  /** Shows the advisory strength meter (Sign Up / Reset Password only). */
  showStrength?: boolean;
};

/**
 * Labeled password input with a show/hide toggle, matching the real Lovable
 * auth field treatment scaled to Nexali's larger approved Auth presence.
 * The toggle is a type="button" control so it never submits the surrounding
 * form, and it only swaps the input's type, so the value itself is
 * untouched.
 */
export function PasswordField({
  label,
  labelExtra,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  minLength,
  invalid,
  errorMessage,
  id,
  showStrength,
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = useState(false);
  const strength = useMemo(() => getPasswordStrength(value), [value]);

  const barTone = (index: number) => {
    if (strength.score <= index) return "bg-surface-highest";
    if (strength.score <= 1) return "bg-destructive";
    if (strength.score === 2) return "bg-warning";
    if (strength.score === 3) return "bg-primary";
    return "bg-success";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId} className="text-[15px] text-muted-foreground sm:text-base">
          {label}
        </Label>
        {labelExtra}
      </div>
      <div className="relative flex items-center">
        <Lock className="pointer-events-none absolute left-4 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <Input
          id={inputId}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid && errorMessage ? errorId : undefined}
          className="h-12 rounded-lg border-outline-variant bg-surface-lowest pl-12 pr-12 text-base sm:h-14"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className={cn(
            "absolute right-2 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {visible ? (
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {showStrength && (
        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn("h-1.5 rounded-full transition-colors", barTone(i))} />
            ))}
          </div>
          <p className="numeric text-xs text-muted-foreground">Strength: {strength.label}</p>
        </div>
      )}

      {invalid && errorMessage && (
        <p id={errorId} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
