import { useState } from "react";
import { Plus } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { TransactionFilterBar } from "../components/TransactionFilterBar";
import { TransactionTable } from "../components/TransactionTable";
import { TransactionDialog } from "../components/TransactionDialog";
import { type Filters } from "../features/querykeys";
import type { TransactionWithCat } from "../lib/transactions";

const DEFAULT_FILTERS: Filters = {
  search: "",
  fromISO: undefined,
  toISO: undefined,
  categoryIds: [],
  types: [],
  minAmount: undefined,
  maxAmount: undefined,
  sortBy: "date",
  sortOrder: "desc",
};

export default function Transactions() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [dialogTarget, setDialogTarget] = useState<"add" | TransactionWithCat | null>(null);

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Financial Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and manage your income and expenses.
          </p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => setDialogTarget("add")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Transaction
        </Button>
      </div>

      <div className="mt-6">
        <TransactionFilterBar filters={filters} onFiltersChange={setFilters} />
      </div>

      <div className="mt-6 md:overflow-hidden md:rounded-xl md:border md:border-border/20 md:bg-gradient-card md:shadow-card">
        <TransactionTable
          filters={filters}
          onAddTransaction={() => setDialogTarget("add")}
          onEditTransaction={(tx) => setDialogTarget(tx)}
        />
      </div>

      <TransactionDialog
        target={dialogTarget}
        onOpenChange={(open) => !open && setDialogTarget(null)}
        // useSaveTransaction already invalidates the transactions query on
        // settle, so the table refetches on its own; nothing extra needed here.
        onSaved={() => {}}
      />
    </PageContainer>
  );
}
