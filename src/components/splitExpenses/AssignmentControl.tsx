import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../../lib/utils";
import {
  YOU_PARTICIPANT_ID,
  describeAssignment,
  isItemAssignmentComplete,
  type ItemAssignment,
  type Participant,
} from "../../lib/splitExpenses";

const MODES = [
  { kind: "mine", label: "Mine" },
  { kind: "shared", label: "Shared" },
  { kind: "someone_else", label: "Someone Else" },
] as const;

/**
 * Fast, popover-based ownership control for one receipt item -- avoids a
 * full modal per item so assigning dozens of items on a large receipt
 * stays usable (per the task's explicit assignment-UX requirement).
 * Selections apply immediately; there is no separate "Save" step inside
 * the popover.
 */
export function AssignmentControl({
  itemName,
  assignment,
  participants,
  onChange,
}: {
  itemName: string;
  assignment: ItemAssignment;
  participants: Participant[];
  onChange: (assignment: ItemAssignment) => void;
}) {
  const [open, setOpen] = useState(false);
  const others = participants.filter((p) => p.id !== YOU_PARTICIPANT_ID);
  const complete = isItemAssignmentComplete(assignment);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Assignment for ${itemName}: ${describeAssignment(assignment, participants)}`}
          className={cn(
            "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
            complete
              ? "border-outline-variant bg-surface-lowest text-foreground hover:border-primary/70"
              : "border-warning/50 bg-warning/10 text-warning-foreground hover:border-warning"
          )}
        >
          <span className="truncate">{describeAssignment(assignment, participants)}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who's responsible?</p>
        <div role="group" aria-label={`Assignment type for ${itemName}`} className="grid grid-cols-3 gap-1 rounded-lg bg-surface-low p-1">
          {MODES.map((mode) => {
            const active = assignment.kind === mode.kind;
            return (
              <button
                key={mode.kind}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (mode.kind === "mine") onChange({ kind: "mine" });
                  else if (mode.kind === "someone_else") onChange({ kind: "someone_else", participantId: null });
                  else onChange({ kind: "shared", participantIds: [] });
                }}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  active ? "bg-surface-high text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {assignment.kind === "someone_else" && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Person</p>
            {others.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add a person first.</p>
            ) : (
              <ul role="listbox" aria-label="Choose person" className="space-y-1">
                {others.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={assignment.participantId === p.id}
                      onClick={() => onChange({ kind: "someone_else", participantId: p.id })}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        assignment.participantId === p.id
                          ? "bg-primary/15 text-primary"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {assignment.kind === "shared" && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Split between (choose 2 or more)</p>
            <ul className="space-y-1">
              {participants.map((p) => {
                const checked = assignment.participantIds.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...assignment.participantIds, p.id]
                            : assignment.participantIds.filter((id) => id !== p.id);
                          onChange({ kind: "shared", participantIds: next });
                        }}
                        className="h-4 w-4 rounded border-outline-variant accent-primary"
                      />
                      {p.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
