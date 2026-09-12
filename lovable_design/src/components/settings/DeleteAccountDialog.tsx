import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRM_WORD = "DELETE";

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const canConfirm = value.trim().toUpperCase() === CONFIRM_WORD;

  const handleOpenChange = (next: boolean) => {
    if (!next) setValue("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-outline-variant/60 bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-destructive">Delete your account</DialogTitle>
          <DialogDescription>
            This permanently erases your financial records, Aura learnings and linked accounts.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="delete-confirm">
            Type <span className="numeric font-semibold text-foreground">{CONFIRM_WORD}</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={CONFIRM_WORD}
          />
        </div>

        <DialogFooter className="max-sm:flex-col-reverse">
          <Button
            variant="surface"
            className="max-sm:w-full"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            className="max-sm:w-full"
            onClick={() => handleOpenChange(false)}
          >
            Delete my account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
