import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { TransactionForm } from "./TransactionForm";
import type { TransactionWithCat } from "../lib/transactions";

type TransactionDialogProps = {
  /** null while closed; "add" to create; a transaction object to edit it. */
  target: "add" | TransactionWithCat | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
};

/**
 * Add/Edit Transaction dialog. A single Radix Dialog instance shared by
 * both flows (rather than one dialog per row), switched by `target`: full
 * screen on mobile, a centered card on tablet/desktop (ui/dialog.tsx).
 */
export function TransactionDialog({ target, onOpenChange, onSaved }: TransactionDialogProps) {
  const open = target !== null;
  const existingTx = target && target !== "add" ? target : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{existingTx ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          <DialogDescription>
            {existingTx
              ? "Update the details for this transaction."
              : "Enter the details for a new transaction."}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <TransactionForm
            existingTx={existingTx}
            onSaved={async () => {
              await onSaved();
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
