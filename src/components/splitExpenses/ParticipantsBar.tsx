import { useState } from "react";
import { AddPersonDialog } from "./AddPersonDialog";
import { FriendAutocomplete } from "./FriendAutocomplete";
import { SelectedParticipantRow } from "./SelectedParticipantRow";
import { ConfirmDialog } from "../ConfirmDialog";
import { YOU_PARTICIPANT_ID, findParticipantReferences, isParticipantReferenced } from "../../lib/splitExpenses";
import type { Participant, SplitReceipt } from "../../lib/splitExpenses";
import type { NexaliUserPreview } from "../../lib/friends";

/**
 * The current split's participant roster -- "You" (fixed, never removable)
 * plus whoever the user adds, either a real accepted Nexali friend (via
 * FriendAutocomplete, reusing the same cached list_friends() data the
 * /friends page uses) or a manually-added non-Nexali person (the
 * pre-existing AddPersonDialog, kept as a clearly separate secondary path).
 * Nothing here is persisted -- this is local Split Expenses page state only
 * (see useSplitExpensesState.ts); removing someone only updates that local
 * state and never calls the real Friends remove_friend RPC.
 */
export function ParticipantsBar({
  participants,
  receipts,
  friends,
  friendsLoading,
  friendsError,
  friendsErrorValue,
  onRetryFriends,
  onAddFriend,
  onAddManualPerson,
  onRemoveParticipant,
}: {
  participants: Participant[];
  receipts: SplitReceipt[];
  friends: NexaliUserPreview[] | undefined;
  friendsLoading: boolean;
  friendsError: boolean;
  friendsErrorValue: unknown;
  onRetryFriends: () => void;
  onAddFriend: (friend: NexaliUserPreview) => void;
  onAddManualPerson: (name: string) => void;
  onRemoveParticipant: (id: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Participant | null>(null);

  const others = participants.filter((p) => p.id !== YOU_PARTICIPANT_ID);
  const excludeIds = new Set(participants.map((p) => p.id));

  const removeRefs = removeTarget ? findParticipantReferences(receipts, removeTarget.id) : null;

  function requestRemove(participant: Participant) {
    const refs = findParticipantReferences(receipts, participant.id);
    if (isParticipantReferenced(refs)) {
      setRemoveTarget(participant);
    } else {
      onRemoveParticipant(participant.id);
    }
  }

  function confirmRemove() {
    if (!removeTarget) return;
    onRemoveParticipant(removeTarget.id);
    setRemoveTarget(null);
  }

  function referencesDescription(refs: ReturnType<typeof findParticipantReferences>, name: string) {
    const parts: string[] = [];
    if (refs.itemCount > 0) parts.push(`assigned to ${refs.itemCount} item${refs.itemCount === 1 ? "" : "s"}`);
    if (refs.payerForReceiptIds.length > 0) {
      parts.push(`the payer for ${refs.payerForReceiptIds.length} receipt${refs.payerForReceiptIds.length === 1 ? "" : "s"}`);
    }
    return `${name} is currently ${parts.join(" and ")}. Removing them will also clear those assignments${
      refs.payerForReceiptIds.length > 0 ? "/payer" : ""
    }, which may leave receipts needing attention before you can process the split.`;
  }

  return (
    <section aria-labelledby="split-people-heading" className="nexali-panel rounded-xl p-4 md:p-5">
      <h2 id="split-people-heading" className="text-sm font-semibold text-foreground">
        People in this split
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        <li className="inline-flex w-fit items-center gap-2 self-start rounded-full border border-outline-variant bg-surface-lowest px-3 py-1.5 text-sm font-medium text-foreground">
          You
        </li>
        {others.map((p) => (
          <SelectedParticipantRow key={p.id} participant={p} onRemove={() => requestRemove(p)} />
        ))}
      </ul>

      <div className="mt-3">
        <FriendAutocomplete
          friends={friends}
          isLoading={friendsLoading}
          isError={friendsError}
          error={friendsErrorValue}
          onRetry={onRetryFriends}
          excludeIds={excludeIds}
          onSelectFriend={onAddFriend}
          onAddManually={() => setDialogOpen(true)}
        />
      </div>

      <AddPersonDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={onAddManualPerson} />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={removeTarget ? `Remove ${removeTarget.name} from this split?` : "Remove from split?"}
        description={removeTarget && removeRefs ? referencesDescription(removeRefs, removeTarget.name) : ""}
        confirmLabel="Remove"
        onConfirm={confirmRemove}
      />
    </section>
  );
}
