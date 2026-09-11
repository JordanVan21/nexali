import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";

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
};

/**
 * Labeled password input with a show/hide toggle. The toggle is a
 * type="button" control so it never submits the surrounding form, and it
 * only swaps the input's type, so the value itself is untouched.
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
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId} className="text-card-foreground">
          {label}
        </Label>
        {labelExtra}
      </div>
      <div className="relative mt-2">
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
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
          className="pl-10 pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {invalid && errorMessage && (
        <p id={errorId} className="mt-1.5 text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
