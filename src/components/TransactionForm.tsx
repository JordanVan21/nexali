import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSaveTransaction } from "../features/transactions/useTransactions";
import { useUserInfo } from "../shared/useUserId";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { CategoryPicker } from "./CategoryPicker";
import { StatusBanner } from "./states/StatusBanner";
import { getErrorMessage } from "../lib/utils";
import { toLocalDateInputValue, occurredAtFromLocalDateInput } from "../lib/transactionDate";
import type { TransactionWithCat } from "../lib/transactions";

type CatItem = { id: number | string; name: string };

type TransactionFormProps = {
  /** null = create a new transaction; an existing transaction = edit it. */
  existingTx: TransactionWithCat | null;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
};

const toTxType = (t: unknown): "income" | "expense" =>
  t === "income" || t === "expense" ? t : "expense";

/**
 * The Add/Edit Transaction form. Fields match the real transactions
 * schema: amount, category, type, merchant, note, and Date (occurred_at --
 * the real financial transaction date, separate from the technical
 * created_at row-insertion timestamp; see docs/BACKEND_AUDIT_REPORT.md
 * §5/P1-3 and Backend Part 3). Date defaults to today and is a plain
 * calendar date, not a date+time picker -- Nexali has no other use for a
 * time-of-day on a transaction yet, and keeping the control simple matches
 * the rest of the form.
 */
export function TransactionForm({ existingTx, onSaved, onCancel }: TransactionFormProps) {
  const [category, setCategory] = useState<CatItem | null>(
    existingTx?.categories
      ? { id: existingTx.categories.id, name: existingTx.categories.name }
      : null
  );
  const [type, setType] = useState<"income" | "expense">(toTxType(existingTx?.categories?.type));
  const [amount, setAmount] = useState(existingTx?.amount?.toString() ?? "");
  const [merchant, setMerchant] = useState(existingTx?.merchant ?? "");
  const [note, setNote] = useState(existingTx?.note ?? "");
  const [occurredAtInput, setOccurredAtInput] = useState(
    existingTx?.occurred_at ? toLocalDateInputValue(new Date(existingTx.occurred_at)) : toLocalDateInputValue(new Date())
  );
  const [amountInvalid, setAmountInvalid] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);

  const { userId } = useUserInfo();
  const saveTx = useSaveTransaction(userId);

  useEffect(() => {
    if (existingTx) {
      setCategory(
        existingTx.categories
          ? { id: existingTx.categories.id, name: existingTx.categories.name }
          : null
      );
      setType(toTxType(existingTx.categories?.type));
      setAmount(existingTx.amount.toString());
      setNote(existingTx.note ?? "");
      setMerchant(existingTx.merchant ?? "");
      setOccurredAtInput(
        existingTx.occurred_at ? toLocalDateInputValue(new Date(existingTx.occurred_at)) : toLocalDateInputValue(new Date())
      );
    } else {
      setCategory(null);
      setType("expense");
      setAmount("");
      setNote("");
      setMerchant("");
      setOccurredAtInput(toLocalDateInputValue(new Date()));
    }
  }, [existingTx]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saveTx.isPending) return;

    setCategoryTouched(true);
    if (!category) return;

    const amt = Number.parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setAmountInvalid(true);
      return;
    }
    setAmountInvalid(false);

    if (!occurredAtInput) return;

    try {
      await saveTx.mutateAsync({
        existingId: existingTx?.id,
        name: category.name.trim(),
        type,
        amount: amt,
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        occurredAt: occurredAtFromLocalDateInput(occurredAtInput),
      });
      await onSaved();
    } catch {
      // saveTx.error already carries the failure for display below;
      // entered field values are intentionally left as-is so the user
      // doesn't lose their draft after a recoverable error.
    }
  };

  const saveError = saveTx.isError
    ? getErrorMessage(saveTx.error, "We couldn't save this transaction.")
    : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {saveError && <StatusBanner variant="error">{saveError}</StatusBanner>}

      <div>
        <Label className="text-foreground">Type</Label>
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant={type === "expense" ? "default" : "outline"}
            aria-pressed={type === "expense"}
            onClick={() => {
              setType("expense");
              setCategory(null);
              setCategoryTouched(false);
            }}
            className="flex-1"
          >
            Expense
          </Button>
          <Button
            type="button"
            variant={type === "income" ? "default" : "outline"}
            aria-pressed={type === "income"}
            onClick={() => {
              setType("income");
              setCategory(null);
              setCategoryTouched(false);
            }}
            className="flex-1"
          >
            Income
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-foreground">Category *</Label>
        <div className="mt-2">
          <CategoryPicker
            userId={userId}
            type={type}
            value={category}
            onChange={(c) => {
              setCategory(c);
              setCategoryTouched(false);
            }}
            placeholder="Select a category"
          />
        </div>
        {categoryTouched && !category && (
          <p className="mt-1.5 text-sm text-destructive">Choose or create a category.</p>
        )}
      </div>

      <div>
        <Label htmlFor="tx-amount" className="text-foreground">
          Amount *
        </Label>
        <Input
          id="tx-amount"
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setAmountInvalid(false);
          }}
          required
          aria-invalid={amountInvalid || undefined}
          aria-describedby={amountInvalid ? "tx-amount-error" : undefined}
          className="mt-2 h-11"
        />
        {amountInvalid && (
          <p id="tx-amount-error" className="mt-1.5 text-sm text-destructive">
            Enter an amount greater than zero.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="tx-date" className="text-foreground">
          Date *
        </Label>
        <Input
          id="tx-date"
          type="date"
          value={occurredAtInput}
          onChange={(e) => setOccurredAtInput(e.target.value)}
          required
          className="mt-2 h-11"
        />
      </div>

      <div>
        <Label htmlFor="tx-merchant" className="text-foreground">
          Merchant
        </Label>
        <Input
          id="tx-merchant"
          type="text"
          placeholder="Where did you shop?"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="mt-2 h-11"
        />
      </div>

      <div>
        <Label htmlFor="tx-note" className="text-foreground">
          Note
        </Label>
        <Input
          id="tx-note"
          type="text"
          placeholder="Optional description"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2 h-11"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="surface" size="control" className="max-sm:w-full" onClick={onCancel} disabled={saveTx.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="hero" size="control" className="max-sm:w-full" disabled={saveTx.isPending}>
          {saveTx.isPending ? "Saving…" : existingTx ? "Save Changes" : "Add Transaction"}
        </Button>
      </div>
    </form>
  );
}
