import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  useExpenseCategories,
  useSaveBudget,
} from "../features/budgets/useBudgetOps";
import { useSignIn, useSignUp } from "../features/user/useSignIn";
import { useUserInfo } from "../shared/useUserId";
import { useSaveTransaction } from "../features/transactions/useTransactions";
import { Label } from "../components/ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ArrowLeft } from "lucide-react";
import type { Budget } from "../lib/budgets";
import type { TransactionWithCat } from "../lib/transactions";
import type { SaveVars } from "../features/transactions/useTransactions";
import { CategoryPicker } from "./CategoryPicker";
import { getErrorMessage } from "../lib/utils";

export default function FieldSet() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();
  const signIn = useSignIn();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (signIn.isPending) {
      return;
    }

    signIn.mutate(
      { email, password },
      {
        onSuccess: () => navigate("/dashboard"),
        onError: (err) => {
          console.error(err);
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email" className="text-card-foreground">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="jordanvan92@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-2"
        ></Input>
      </div>

      <div>
        <Label htmlFor="password" className="text-card-foreground">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="*****************"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-2"
        ></Input>
      </div>

      {signIn.isError && (
        <p className="text-red-500 text-base-content">
          {signIn.error?.message ?? "Sign-in failed"}
        </p>
      )}

      <Button
        type="submit"
        variant="hero"
        className="w-full mt-6"
        size="lg"
        disabled={signIn.isPending}
      >
        {signIn.isPending ? "Signing in…" : "Sign In"}
      </Button>

      <div className="text-center">
        <Button variant="link" className="text-muted-foreground">
          <Link to="/signup">Don't have an account? Register</Link>
        </Button>
      </div>

      <div className="mt-8 pt-6 border-t border-border/50">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Landing Page
        </Button>
      </div>
    </form>
  );
}

function RegisterField() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const navigate = useNavigate();
  const signUp = useSignUp();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (signUp.isPending) {
      return;
    }

    signUp.mutate(
      { fullName, email, password },
      {
        onSuccess: () => {
          setMessage("Check your email to confirm your account.");
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="fullName" className="text-card-foreground">
          Full Name
        </Label>
        <Input
          id="fullName"
          type="text"
          placeholder="Jordan Van"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="mt-2"
        ></Input>
      </div>

      <div>
        <Label htmlFor="email" className="text-card-foreground">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="picklejn@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-2"
        ></Input>
      </div>

      <div>
        <Label htmlFor="password" className="text-card-foreground">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="*****************"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-2"
        ></Input>
      </div>

      {signUp.isError && (
        <p className="text-red-500 text-base-content text-lg">
          {(signUp.error as Error).message ?? "Registration failed"}
        </p>
      )}

      {message && (
        <div className="p-3 text-center text-sm text-green-600 bg-green-50 border-green-200 rounded-md">
          {message}
        </div>
      )}

      <Button
        type="submit"
        variant="hero"
        className="w-full mt-6"
        size="lg"
        disabled={signUp.isPending}
      >
        Create Account
      </Button>

      <div className="text-center">
        <Button variant="link" className="text-muted-foreground">
          <Link to="/signin">Already have an account? Sign In</Link>
        </Button>
      </div>

      <div className="mt-8 pt-6 border-t border-broder/50">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Landing Page
        </Button>
      </div>
    </form>
  );
}

export { RegisterField };

type OnCreated = () => void | Promise<void>;
type CatItem = { id: number | string; name: string };

type AddFieldProps = {
  onCreated?: OnCreated;
  existingTx?: TransactionWithCat | null;
  onClose?: () => void;
};

function AddField({ onCreated, existingTx, onClose }: AddFieldProps) {
  const toTxType = (t: unknown): "income" | "expense" =>
    t === "income" || t === "expense" ? t : "expense";

  // Change category to be a CatItem object instead of string
  const [category, setCategory] = useState<CatItem | null>(
    existingTx?.categories
      ? { id: existingTx.categories.id, name: existingTx.categories.name }
      : null
  );

  const [type, setType] = useState<"income" | "expense">(
    toTxType(existingTx?.categories?.type)
  );
  const [amount, setAmount] = useState(existingTx?.amount?.toString() ?? "");
  const [merchant, setMerchant] = useState(existingTx?.merchant ?? "");
  const [note, setNote] = useState(existingTx?.note ?? "");

  const { userId } = useUserInfo();
  const saveTx = useSaveTransaction(userId);

  const closeModal = () => onClose?.();

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
    } else {
      setCategory(null);
      setType("expense");
      setAmount("");
      setNote("");
      setMerchant("");
    }
  }, [existingTx]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || saveTx.isPending || !category) return;

    const amt = Number.parseFloat(amount);

    const payload: SaveVars = {
      existingId: existingTx?.id,
      name: category.name.trim(),
      type,
      amount: amt,
      merchant: merchant.trim() || null,
      note: note.trim() || null,
    };

    await saveTx.mutateAsync(payload);
    await onCreated?.();
    onClose?.();

    if (!existingTx) {
      setCategory(null);
      setType("expense");
      setAmount("");
      setNote("");
      setMerchant("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {existingTx ? "Edit Transaction" : "Add Transactions"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {existingTx
              ? "Update your transaction details"
              : "Add a new transaction to your records"}
          </p>
        </div>

        {saveTx.isError && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            {(saveTx.error as Error)?.message ?? "Failed to save transaction."}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="text-foreground">Type *</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={type === "expense" ? "default" : "outline"}
                onClick={() => {
                  setType("expense");
                  setCategory(null); // Reset to null instead of empty string
                }}
                className="flex-1 text-base-content text-white"
              >
                Expense
              </Button>

              <Button
                type="button"
                variant={type === "income" ? "default" : "outline"}
                onClick={() => {
                  setType("income");
                  setCategory(null); // Reset to null instead of empty string
                }}
                className="flex-1 text-base-content text-white"
              >
                Income
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-foreground">Category *</Label>
            <CategoryPicker
              userId={userId}
              type={type}
              value={category}
              onChange={setCategory}
              enabled={!!type} // Change from disabled to enabled
              placeholder="Select a category"
            />
          </div>

          <div>
            <Label htmlFor="amount" className="text-foreground">
              Amount *
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="mt-1 text-base-content text-white"
            />
          </div>

          <div>
            <Label htmlFor="merchant" className="text-foreground">
              Merchant
            </Label>
            <Input
              id="merchant"
              type="text"
              placeholder="Where did you shop?"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="mt-1 text-base-content text-white"
            />
          </div>

          <div>
            <Label htmlFor="note" className="text-foreground">
              Note
            </Label>
            <Input
              id="note"
              type="text"
              placeholder="Optional description"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 text-base-content text-white"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            variant="hero"
            disabled={!userId || saveTx.isPending || !category}
            className="flex-1 text-base-content text-white"
          >
            {saveTx.isPending
              ? "Saving..."
              : existingTx
              ? "Update"
              : "Add Transaction"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={closeModal}
            disabled={saveTx.isPending}
            className="text-base-content text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

export { AddField };

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
