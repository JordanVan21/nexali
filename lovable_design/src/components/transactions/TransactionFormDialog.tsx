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
import { Textarea } from "@/components/ui/textarea";
import type { Transaction, TransactionCategory, TransactionType } from "@/mock/transactions";

export type TransactionFormValues = {
  merchant: string;
  date: string;
  categoryId: string;
  type: TransactionType;
  amount: string;
  direction: "expense" | "income";
  note: string;
};

export type TransactionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a transaction to edit, or null to create. */
  transaction: Transaction | null;
  categories: TransactionCategory[];
  types: TransactionType[];
  onSubmit: (values: TransactionFormValues) => void;
};

const emptyValues: TransactionFormValues = {
  merchant: "",
  date: new Date().toISOString().slice(0, 10),
  categoryId: "",
  type: "Debit",
  amount: "",
  direction: "expense",
  note: "",
};

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  categories,
  types,
  onSubmit,
}: TransactionFormDialogProps) {
  const [values, setValues] = useState<TransactionFormValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormValues, string>>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      transaction
        ? {
            merchant: transaction.merchant,
            date: transaction.date,
            categoryId: transaction.category.id,
            type: transaction.type,
            amount: Math.abs(transaction.amount).toFixed(2),
            direction: transaction.amount < 0 ? "expense" : "income",
            note: transaction.note ?? "",
          }
        : emptyValues,
    );
  }, [open, transaction]);

  const set = (patch: Partial<TransactionFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!values.merchant.trim()) next.merchant = "Merchant is required.";
    if (!values.date) next.date = "Pick a date.";
    if (!values.categoryId) next.categoryId = "Choose a category.";
    const amount = Number(values.amount);
    if (!values.amount || Number.isNaN(amount) || amount <= 0)
      next.amount = "Enter an amount greater than 0.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit(values);
  };

  const isEdit = Boolean(transaction);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh gap-0 overflow-y-auto rounded-none border-outline-variant/60 bg-card p-0 sm:max-w-lg sm:rounded-2xl max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:left-0 max-sm:top-0">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader className="border-b border-outline-variant/40 px-5 py-4 text-left">
            <DialogTitle className="font-display text-xl">
              {isEdit ? "Edit transaction" : "Add transaction"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the details of this activity."
                : "Record a new item in your financial activity."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-5">
            <div className="grid gap-2">
              <Label htmlFor="merchant">Merchant</Label>
              <Input
                id="merchant"
                value={values.merchant}
                onChange={(e) => set({ merchant: e.target.value })}
                placeholder="Whole Foods Market"
                aria-invalid={Boolean(errors.merchant)}
                aria-describedby={errors.merchant ? "merchant-error" : undefined}
                className="h-11 border-outline-variant bg-surface-lowest"
              />
              {errors.merchant && (
                <p id="merchant-error" className="text-xs text-destructive">
                  {errors.merchant}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={values.amount}
                  onChange={(e) => set({ amount: e.target.value })}
                  placeholder="0.00"
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={errors.amount ? "amount-error" : undefined}
                  className="numeric h-11 border-outline-variant bg-surface-lowest"
                />
                {errors.amount && (
                  <p id="amount-error" className="text-xs text-destructive">
                    {errors.amount}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="direction">Direction</Label>
                <Select
                  value={values.direction}
                  onValueChange={(v) => set({ direction: v as TransactionFormValues["direction"] })}
                >
                  <SelectTrigger id="direction" className="h-11 border-outline-variant bg-surface-lowest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select value={values.categoryId} onValueChange={(v) => set({ categoryId: v })}>
                  <SelectTrigger
                    id="category"
                    aria-invalid={Boolean(errors.categoryId)}
                    className="h-11 border-outline-variant bg-surface-lowest"
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryId && (
                  <p className="text-xs text-destructive">{errors.categoryId}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={values.type}
                  onValueChange={(v) => set({ type: v as TransactionType })}
                >
                  <SelectTrigger id="type" className="h-11 border-outline-variant bg-surface-lowest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={values.date}
                onChange={(e) => set({ date: e.target.value })}
                aria-invalid={Boolean(errors.date)}
                className="h-11 border-outline-variant bg-surface-lowest"
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                value={values.note}
                onChange={(e) => set({ note: e.target.value })}
                rows={3}
                className="resize-none border-outline-variant bg-surface-lowest"
              />
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
              {isEdit ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
