import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AuraComposer({
  value,
  onValueChange,
  onSend,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean | undefined;
}) {
  const [localValue, setLocalValue] = useState(value);

  const current = value || localValue;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = current.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setLocalValue("");
    onValueChange("");
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-high p-2 pl-4 focus-within:border-primary">
        <label htmlFor="aura-composer-input" className="sr-only">
          Ask Aura anything about your finances
        </label>
        <input
          id="aura-composer-input"
          value={current}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onValueChange(e.target.value);
          }}
          placeholder="Ask Aura anything about your finances…"
          className="min-h-11 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-base"
          disabled={disabled}
        />
        <Button
          type="submit"
          size="icon-lg"
          variant="brand"
          disabled={disabled || !current.trim()}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
        Aura AI can make mistakes. Check important financial info.
      </p>
    </form>
  );
}
