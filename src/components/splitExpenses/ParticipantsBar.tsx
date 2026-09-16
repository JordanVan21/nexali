import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "../ui/button";
import { AddPersonDialog } from "./AddPersonDialog";
import { getInitials } from "../../lib/utils";
import type { Participant } from "../../lib/splitExpenses";

/**
 * Frontend-only participant roster for the current split -- "You" plus
 * whoever the user adds via Add Person. Nothing here is persisted; it
 * exists only for this page's session (see useSplitExpensesState.ts).
 * Structured as a plain array of {id, name} so a future real Friends
 * feature can supply the same shape instead of this temporary state.
 */
export function ParticipantsBar({
  participants,
  onAddPerson,
}: {
  participants: Participant[];
  onAddPerson: (name: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <section aria-labelledby="split-people-heading" className="nexali-panel rounded-xl p-4 md:p-5">
      <h2 id="split-people-heading" className="text-sm font-semibold text-foreground">
        People in this split
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {participants.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-lowest px-3 py-1.5 text-sm text-foreground"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
              {getInitials(p.name, null)}
            </span>
            {p.name}
          </span>
        ))}
        <Button type="button" variant="surface" size="sm" onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Add Person
        </Button>
      </div>

      <AddPersonDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={onAddPerson} />
    </section>
  );
}
