import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { TransactionFilterBar } from "../components/TransactionFilterBar";
import { TransactionTable } from "../components/TransactionTable";
import { TransactionAnalytics } from "../components/TransactionAnalytics";
import { TransactionDialog } from "../components/TransactionDialog";
import { useTransactionWithFilters } from "../features/transactions/useTransactions";
import { useUserInfo } from "../shared/useUserId";
import { buildTransactionsCsv, downloadCsv } from "../lib/csvExport";
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

  const { userId } = useUserInfo();
  // Same query key TransactionTable uses for this filter set, so this shares
  // its cached fetch (TanStack Query dedupes by key) rather than issuing a
  // second request purely for Export.
  const exportQuery = useTransactionWithFilters(userId, filters);
  const exportRows = exportQuery.data ?? [];

  const handleExport = () => {
    const csv = buildTransactionsCsv(exportRows);
    downloadCsv(`nexali-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl xl:text-[32px] 2xl:text-[34px]">
            Financial Activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Review and manage your income, expenses, and recent financial activity.
          </p>
        </div>
        <div className="flex items-center gap-2 max-sm:w-full">
          <Button
            type="button"
            variant="surface"
            size="control"
            className="max-sm:hidden"
            onClick={handleExport}
            disabled={exportRows.length === 0}
            title={
              exportRows.length === 0
                ? "No transactions currently shown to export"
                : "Export the transactions currently shown (up to 50 matching rows) as CSV"
            }
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </Button>
          <Button variant="hero" size="control" className="max-sm:flex-1" onClick={() => setDialogTarget("add")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Transaction
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <TransactionFilterBar filters={filters} onFiltersChange={setFilters} />
      </div>

      <div className="mt-6 md:mt-8 md:overflow-hidden md:rounded-xl md:border md:border-border/20 md:bg-gradient-card md:shadow-card xl:mt-10">
        <TransactionTable
          filters={filters}
          onAddTransaction={() => setDialogTarget("add")}
          onEditTransaction={(tx) => setDialogTarget(tx)}
        />
      </div>

      <div className="mt-6 md:mt-8 xl:mt-10">
        <TransactionAnalytics filters={filters} />
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
