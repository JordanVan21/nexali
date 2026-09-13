import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CategoryPicker } from "../CategoryPicker";
import { useExpenseCategories, useSaveBudget } from "../../features/budgets/useBudgetOps";
import { isDuplicateBudgetError } from "../../lib/budgets";
import { getErrorMessage } from "../../lib/utils";
import type { Budget } from "../../lib/budgets";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type CatItem = { id: number; name: string };

function getSaveBudgetErrorMessage(error: unknown): string {
  if (isDuplicateBudgetError(error)) {
    return "A budget already exists for this category in that month and year. Edit the existing budget instead.";
  }
  return getErrorMessage(error, "Failed to save budget");
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  userId,
  editing,
  defaultMonth,
  defaultYear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** null = create a new budget for the currently-selected period; a budget = edit it. */
  editing: Budget | null;
  /** Month/year a newly-created budget should default to (the page's currently-selected period). */
  defaultMonth: number;
  defaultYear: number;
}) {
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [category, setCategory] = useState<CatItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isLoading: catsLoading, isError: catsError, error: catsErrorObj } = useExpenseCategories(userId);
  const { mutateAsync: saveBudget, isPending: saving } = useSaveBudget();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setAmount(editing.amount.toString());
      setMonth(editing.month);
      setYear(editing.year);
      setCategory(editing.categories ? { id: editing.categories.id, name: editing.categories.name } : null);
    } else {
      setAmount("");
      setMonth(defaultMonth);
      setYear(defaultYear);
      setCategory(null);
    }
  }, [open, editing, defaultMonth, defaultYear]);

  const isEdit = editing != null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amt = Number.parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    if (!category) {
      setError("Choose a category.");
      return;
    }

    try {
      await saveBudget({
        id: editing?.id,
        userId,
        categoryId: category.id,
        amount: amt,
        month,
        year,
      });
      onOpenChange(false);
    } catch (err) {
      setError(getSaveBudgetErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg sm:rounded-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-outline-variant/40 px-5 py-4 text-left">
            <DialogTitle className="font-display text-xl">{isEdit ? "Edit Budget" : "Add Budget"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this category's monthly limit." : "Set a monthly spending limit for a category."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-5">
            {catsError && (
              <p className="text-sm text-destructive">{getErrorMessage(catsErrorObj, "Failed to load categories")}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="grid gap-2">
              <Label htmlFor="budget-category">Category</Label>
              <CategoryPicker
                userId={userId}
                type="expense"
                value={category}
                onChange={(cat) => setCategory({ id: Number(cat.id), name: cat.name })}
                placeholder={catsLoading ? "Loading…" : "Choose a category…"}
                enabled={!catsLoading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="budget-amount">Monthly limit</Label>
              <Input
                id="budget-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="500.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="budget-month">Month</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger id="budget-month" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={name} value={String(i + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="budget-year">Year</Label>
                <Input
                  id="budget-year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  required
                  className="h-11"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-outline-variant/40 px-5 py-4 max-sm:flex-col-reverse">
            <Button
              type="button"
              variant="surface"
              size="control"
              className="max-sm:w-full"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="hero" size="control" className="max-sm:w-full" disabled={saving || catsLoading}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
