import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { StatusBanner } from "./states/StatusBanner";

const CONFIRM_WORD = "DELETE";

type DeleteAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  errorMessage?: string | null;
};

/**
 * Typed-confirmation destructive dialog for account deletion, matching
 * Lovable's real account.tsx pattern (type DELETE to enable the button)
 * rather than the app's single-click ConfirmDialog, since this action is
 * irreversible and destroys the signed-in session itself.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  errorMessage = null,
}: DeleteAccountDialogProps) {
  const [value, setValue] = useState("");
  const canConfirm = value.trim().toUpperCase() === CONFIRM_WORD;

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-destructive">Delete your account</DialogTitle>
          <DialogDescription>
            This permanently deletes your transactions, budgets, categories and profile, and signs
            you out. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && <StatusBanner variant="error">{errorMessage}</StatusBanner>}

        <div className="space-y-1.5">
          <Label htmlFor="delete-account-confirm">
            Type <span className="numeric font-semibold text-foreground">{CONFIRM_WORD}</span> to confirm
          </Label>
          <Input
            id="delete-account-confirm"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={CONFIRM_WORD}
            disabled={isPending}
            className="h-11"
          />
        </div>

        <DialogFooter className="max-sm:flex-col-reverse">
          <Button
            type="button"
            variant="outline"
            className="max-sm:w-full"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="max-sm:w-full"
            disabled={!canConfirm || isPending}
            onClick={onConfirm}
          >
            {isPending ? "Deleting…" : "Delete my account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
