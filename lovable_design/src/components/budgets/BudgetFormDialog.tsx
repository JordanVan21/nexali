import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Budget, BudgetIcon } from "@/mock/budgets";

export type BudgetFormValues = {
  category: string;
  description: string;
  icon: BudgetIcon;
  limit: string;
  spent: string;
};

const iconOptions: { value: BudgetIcon; label: string }[] = [
  { value: "home", label: "Housing" },
  { value: "restaurant", label: "Dining" },
  { value: "car", label: "Transport" },
  { value: "savings", label: "Savings / Investment" },
  { value: "cart", label: "Groceries" },
  { value: "bolt", label: "Utilities" },
  { value: "plane", label: "Travel" },
  { value: "gift", label: "Gifts" },
];

const emptyValues: BudgetFormValues = {
  category: "",
  description: "",
  icon: "home",
  limit: "",
  spent: "0",
};

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget | null;
  onSubmit: (values: BudgetFormValues) => void;
}) {
  const [values, setValues] = useState<BudgetFormValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<keyof BudgetFormValues, string>>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      budget
        ? {
            category: budget.category,
            description: budget.description,
            icon: budget.icon,
            limit: budget.limit.toFixed(2),
            spent: budget.spent.toFixed(2),
          }
        : emptyValues,
    );
  }, [open, budget]);

  const set = (patch: Partial<BudgetFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!values.category.trim()) next.category = "Category name is required.";
    const limit = Number(values.limit);
    if (!values.limit || Number.isNaN(limit) || limit <= 0) next.limit = "Enter a limit greater than 0.";
    const spent = Number(values.spent);
    if (values.spent !== "" && (Number.isNaN(spent) || spent < 0)) next.spent = "Enter a valid spent amount.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit(values);
  };

  const isEdit = Boolean(budget);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh gap-0 overflow-y-auto rounded-none border-outline-variant/60 bg-card p-0 sm:max-w-lg sm:rounded-2xl max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:left-0 max-sm:top-0">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader className="border-b border-outline-variant/40 px-5 py-4 text-left">
            <DialogTitle className="font-display text-xl">
              {isEdit ? "Edit budget" : "Create budget"}
            </DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this category's monthly allocation." : "Set a monthly spending limit for a new category."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-5">
            <div className="grid gap-2">
              <Label htmlFor="category">Category name</Label>
              <Input
                id="category"
                value={values.category}
                onChange={(e) => set({ category: e.target.value })}
                placeholder="Dining Out"
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? "category-error" : undefined}
                className="h-11 border-outline-variant bg-surface-lowest"
              />
              {errors.category && (
                <p id="category-error" className="text-xs text-destructive">
                  {errors.category}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={values.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Food & entertainment"
                className="h-11 border-outline-variant bg-surface-lowest"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="icon">Icon</Label>
              <Select value={values.icon} onValueChange={(v) => set({ icon: v as BudgetIcon })}>
                <SelectTrigger id="icon" className="h-11 border-outline-variant bg-surface-lowest">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="limit">Monthly limit</Label>
                <Input
                  id="limit"
                  inputMode="decimal"
                  value={values.limit}
                  onChange={(e) => set({ limit: e.target.value })}
                  placeholder="500.00"
                  aria-invalid={Boolean(errors.limit)}
                  aria-describedby={errors.limit ? "limit-error" : undefined}
                  className="numeric h-11 border-outline-variant bg-surface-lowest"
                />
                {errors.limit && (
                  <p id="limit-error" className="text-xs text-destructive">
                    {errors.limit}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spent">Spent so far</Label>
                <Input
                  id="spent"
                  inputMode="decimal"
                  value={values.spent}
                  onChange={(e) => set({ spent: e.target.value })}
                  placeholder="0.00"
                  aria-invalid={Boolean(errors.spent)}
                  aria-describedby={errors.spent ? "spent-error" : undefined}
                  className="numeric h-11 border-outline-variant bg-surface-lowest"
                />
                {errors.spent && (
                  <p id="spent-error" className="text-xs text-destructive">
                    {errors.spent}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-outline-variant/40 px-5 py-4 max-sm:flex-col-reverse">
            <Button
              type="button"
              variant="surface"
              size="control"
              onClick={() => onOpenChange(false)}
              className="max-sm:w-full"
            >
              Cancel
            </Button>
            <Button type="submit" variant="brand" size="control" className="max-sm:w-full">
              {isEdit ? "Save changes" : "Create budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
