import { useId, useMemo, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

export function getPasswordStrength(value: string): PasswordStrength {
  if (!value) return { score: 0, label: "Empty" };
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const labels = ["Weak", "Weak", "Fair", "Good", "Strong"];
  return { score: score as PasswordStrength["score"], label: labels[score] ?? "Weak" };
}

interface PasswordFieldProps {
  id?: string | undefined;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  autoComplete?: string | undefined;
  showStrength?: boolean | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = "••••••••",
  autoComplete = "current-password",
  showStrength,
  error,
  required,
}: PasswordFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const [visible, setVisible] = useState(false);
  const strength = useMemo(() => getPasswordStrength(value), [value]);

  const barColor = (index: number) => {
    if (strength.score <= index) return "bg-surface-highest";
    if (strength.score <= 1) return "bg-destructive";
    if (strength.score === 2) return "bg-warning";
    if (strength.score === 3) return "bg-primary";
    return "bg-success";
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <div className="relative flex items-center">
        <Lock className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id={fieldId}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-12 rounded-lg border-outline-variant bg-surface-lowest pl-10 pr-11 text-base"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showStrength ? (
        <div className="space-y-1 pt-1">
          <div className="grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn("h-1.5 rounded-full transition-colors", barColor(i))} />
            ))}
          </div>
          <p className="numeric text-xs text-muted-foreground">Strength: {strength.label}</p>
        </div>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
