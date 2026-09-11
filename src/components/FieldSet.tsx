import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import {
  useExpenseCategories,
  useSaveBudget,
} from "../features/budgets/useBudgetOps";
import { useUserInfo } from "../shared/useUserId";
import { Label } from "../components/ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import type { Budget } from "../lib/budgets";
import { CategoryPicker } from "./CategoryPicker";
import { getErrorMessage } from "../lib/utils";

type OnCreated = () => void | Promise<void>;

type AddBudgetProps = {
  onCreated?: OnCreated;
  existingTx?: Budget | null;
  onClose?: () => void;
};

function AddBudget({ onCreated, existingTx, onClose }: AddBudgetProps) {
  const [amount, setAmount] = useState(existingTx?.amount?.toString() ?? "");
  const [month, setMonth] = useState(existingTx?.month?.toString() ?? "");
  const [year, setYear] = useState(existingTx?.year?.toString() ?? "");

  const [selectedCategory, setSelectedCategory] = useState<{ id: number; name: string } | null>(
    existingTx?.categories ? { id: existingTx.categories.id, name: existingTx.categories.name } : null
  );
  const [error, setError] = useState<string | null>(null);

  const { userId } = useUserInfo();

  const {
    isLoading: catsLoading,
    isError: catsError,
    error: catsErrorObj,
  } = useExpenseCategories(userId);

  const { mutateAsync: saveBudget, isPending: saving } = useSaveBudget();

  const closeModal = () => onClose?.();

  useEffect(() => {
    if (existingTx) {
      setAmount(existingTx.amount.toString());
      setMonth(existingTx.month.toString());
      setYear(existingTx.year.toString());
      setSelectedCategory(
        existingTx.categories ? { id: existingTx.categories.id, name: existingTx.categories.name } : null
      );
    } else {
      setAmount("");
      setMonth("");
      setYear("");
      setSelectedCategory(null);
    }
  }, [existingTx]);

  function parseAndValidate() {
    const amt = Number.parseFloat(amount);
    const m = Number.parseInt(month, 10);
    const y = Number.parseInt(year, 10);

    if (!Number.isFinite(amt) || amt <= 0) return "Enter a valid amount.";
    if (!Number.isInteger(m) || m < 1 || m > 12) return "Month must be 1–12.";
    if (!Number.isInteger(y) || y < 2000 || y > 2100)
      return "Year looks invalid.";
    if (selectedCategory == null) return "Choose a category.";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = parseAndValidate();
    if (validation) {
      setError(validation);
      return;
    }

    try {
      await saveBudget({
        id: existingTx?.id,
        userId: userId!,
        categoryId: selectedCategory!.id,
        amount: Number(amount),
        month: Number(month),
        year: Number(year),
      });

      await onCreated?.();
      onClose?.();

      if (!existingTx) {
        setAmount("");
        setMonth("");
        setYear("");
        setSelectedCategory(null);
      }
    } catch (e) {
      setError(getErrorMessage(e, "Failed to save budget"));
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {existingTx ? "Edit Budget" : "Add Budget"}
          </h2>
        </div>

        {/* Error Messages */}
        {catsError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-destructive text-sm">
              {catsErrorObj?.message ?? "Failed to load categories"}
            </p>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium text-foreground">
              Category *
            </Label>
            <CategoryPicker
              userId={userId}
              type="expense"
              value={selectedCategory}
              onChange={(cat) => setSelectedCategory({ id: Number(cat.id), name: cat.name })}
              placeholder={catsLoading ? "Loading..." : "Choose a category..."}
              enabled={!catsLoading}
            />
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium text-foreground">
              Amount *
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="200"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              step="0.01"
              min="0.01"
              className="bg-popover border-border hover:border-primary/50 focus:border-primary text-white placeholder:text-muted-foreground"
            />
          </div>

          {/* Month and Year Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month" className="text-sm font-medium text-foreground">
                Month *
              </Label>
              <Input
                id="month"
                type="number"
                placeholder="7"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                min="1"
                max="12"
                className="bg-popover border-border hover:border-primary/50 focus:border-primary text-white placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year" className="text-sm font-medium text-foreground">
                Year *
              </Label>
              <Input
                id="year"
                type="number"
                placeholder="2025"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
                min="2000"
                max="2100"
                className="bg-popover border-border hover:border-primary/50 focus:border-primary text-white placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={closeModal}
            className="flex-1 sm:flex-none border-border text-foreground hover:bg-muted sm:min-w-[100px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300 hover:scale-[1.02] flex-1 sm:flex-none text-primary-foreground font-medium sm:min-w-[120px]"
            disabled={saving || catsLoading}
          >
            {saving ? "Saving…" : existingTx ? "Save Changes" : "Add Budget"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export { AddBudget };
