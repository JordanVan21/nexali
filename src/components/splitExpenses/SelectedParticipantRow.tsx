import { XCircle } from "lucide-react";
import { Button } from "../ui/button";
import { ProfileAvatar } from "../ProfileAvatar";
import type { Participant } from "../../lib/splitExpenses";

/**
 * One selected (non-"You") participant in the current split -- a compact
 * card (avatar, name, email if known) with a small remove control, per the
 * task's explicit "not a large destructive button" instruction.
 *
 * The remove control is ALWAYS visible on narrow/touch viewports (no hover
 * gesture exists there to reveal it) and fades in on hover/focus only at
 * the `md:` breakpoint and up (desktop) -- `md:focus:opacity-100` and the
 * parent's `group-focus-within` both guarantee it's also reachable via
 * keyboard Tab focus alone, never hover-only, on every viewport.
 */
export function SelectedParticipantRow({
  participant,
  onRemove,
}: {
  participant: Participant;
  onRemove: () => void;
}) {
  return (
    <li className="group relative flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-lowest py-2.5 pl-2.5 pr-11">
      <ProfileAvatar name={participant.name} email={participant.email} imageUrl={participant.avatarUrl} className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{participant.name}</p>
        {participant.email && <p className="truncate text-xs text-muted-foreground">{participant.email}</p>}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove ${participant.name} from split`}
        onClick={onRemove}
        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground opacity-100 transition-opacity hover:text-destructive focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      >
        <XCircle className="h-4 w-4" aria-hidden="true" />
      </Button>
    </li>
  );
}
