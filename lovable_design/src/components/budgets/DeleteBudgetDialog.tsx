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
import type { Budget } from "@/mock/budgets";

export function DeleteBudgetDialog({
  budget,
  open,
  onOpenChange,
  onConfirm,
}: {
  budget: Budget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-outline-variant/60 bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Delete this budget?</AlertDialogTitle>
          <AlertDialogDescription>
            {budget
              ? `“${budget.category}” will be removed from your budget plan. This can’t be undone.`
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
