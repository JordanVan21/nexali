import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

/**
 * Frontend-only "Add Person" dialog -- name only, no email/username/invite,
 * per the task's explicit scope (the real Friends feature is a later
 * phase). The created person exists only in this page's React state.
 */
export function AddPersonDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setName("");
    onOpenChange(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-sm sm:rounded-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-outline-variant/40 px-5 py-4 text-left">
            <DialogTitle className="font-display text-xl">Add Person</DialogTitle>
            <DialogDescription>Add someone to split this purchase with.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 px-5 py-5">
            <Label htmlFor="split-person-name">Name</Label>
            <Input
              id="split-person-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              required
              className="h-11"
            />
          </div>

          <DialogFooter className="gap-2 border-t border-outline-variant/40 px-5 py-4 max-sm:flex-col-reverse">
            <Button type="button" variant="surface" size="control" className="max-sm:w-full" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" size="control" className="max-sm:w-full" disabled={!name.trim()}>
              Add Person
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
