import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Transaction } from "@/mock/transactions";

export function DeleteTransactionDialog({
  transaction,
  open,
  onOpenChange,
  onConfirm,
}: {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-outline-variant/60 bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Delete this transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            {transaction
              ? `“${transaction.merchant}” will be removed from your financial activity. This can’t be undone.`
              : "This can’t be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="max-sm:flex-col-reverse">
          <AlertDialogCancel className="border-outline-variant bg-surface-lowest max-sm:w-full">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 max-sm:w-full"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
