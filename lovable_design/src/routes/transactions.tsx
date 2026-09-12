import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionCard } from "@/components/transactions/TransactionCard";
import {
  TransactionFilters,
  type TransactionFilterState,
} from "@/components/transactions/TransactionFilters";
import { TransactionFormDialog, type TransactionFormValues } from "@/components/transactions/TransactionFormDialog";
import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import { DailyBurnCard, TopCategoriesCard } from "@/components/transactions/SpendingSummary";
import {
  mockCategories,
  mockNotificationCount,
  mockSpendingInsights,
  mockTransactionTypes,
  mockTransactions,
  mockUser,
  type Transaction,
} from "@/mock/transactions";

const title = "Transactions — Nexali";
const description =
  "Review, search and manage every transaction across your connected accounts in Nexali.";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransactionsPage,
});

const PAGE_SIZE = 8;
const emptyFilters: TransactionFilterState = {
  search: "",
  categoryId: "all",
  type: "all",
  method: "all",
  amount: "all",
  sort: "date-desc",
};

const amountRanges: Record<string, [number, number]> = {
  "0-50": [0, 50],
  "50-200": [50, 200],
  "200-1000": [200, 1000],
  "1000+": [1000, Number.POSITIVE_INFINITY],
};

function TransactionsPage() {
  // Local mock state only — swap for real Nexali hooks during integration.
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [filters, setFilters] = useState<TransactionFilterState>(emptyFilters);
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const range = amountRanges[filters.amount];

    const rows = transactions.filter((t) => {
      const matchesSearch =
        !q ||
        t.merchant.toLowerCase().includes(q) ||
        t.category.name.toLowerCase().includes(q) ||
        (t.note?.toLowerCase().includes(q) ?? false);
      const matchesCategory = filters.categoryId === "all" || t.category.id === filters.categoryId;
      const matchesType =
        filters.type === "all" ||
        (filters.type === "income" ? t.amount > 0 : t.amount < 0);
      const matchesMethod = filters.method === "all" || t.type === filters.method;
      const magnitude = Math.abs(t.amount);
      const matchesAmount = !range || (magnitude >= range[0] && magnitude < range[1]);
      return matchesSearch && matchesCategory && matchesType && matchesMethod && matchesAmount;
    });

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (filters.sort) {
        case "date-asc":
          return a.date.localeCompare(b.date);
        case "amount-desc":
          return Math.abs(b.amount) - Math.abs(a.amount);
        case "amount-asc":
          return Math.abs(a.amount) - Math.abs(b.amount);
        case "merchant-asc":
          return a.merchant.localeCompare(b.merchant);
        default:
          return b.date.localeCompare(a.date);
      }
    });
    return sorted;
  }, [transactions, filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeFilterCount =
    (filters.categoryId !== "all" ? 1 : 0) +
    (filters.type !== "all" ? 1 : 0) +
    (filters.method !== "all" ? 1 : 0) +
    (filters.amount !== "all" ? 1 : 0) +
    (filters.sort !== "date-desc" ? 1 : 0);
  const isFiltering = activeFilterCount > 0 || filters.search.trim().length > 0;

  const updateFilters = (next: TransactionFilterState) => {
    setFilters(next);
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (transaction: Transaction) => {
    setEditing(transaction);
    setFormOpen(true);
  };

  const handleSubmit = (values: TransactionFormValues) => {
    const category = mockCategories.find((c) => c.id === values.categoryId)!;
    const magnitude = Math.abs(Number(values.amount));
    const amount = values.direction === "expense" ? -magnitude : magnitude;

    if (editing) {
      setTransactions((list) =>
        list.map((t) =>
          t.id === editing.id
            ? { ...t, merchant: values.merchant.trim(), date: values.date, category, type: values.type, amount, note: values.note }
            : t,
        ),
      );
      toast.success("Transaction updated");
    } else {
      setTransactions((list) => [
        {
          id: `local-${Date.now()}`,
          merchant: values.merchant.trim(),
          date: values.date,
          category,
          type: values.type,
          amount,
          note: values.note,
        },
        ...list,
      ]);
      toast.success("Transaction added");
    }
    setFormOpen(false);
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    setTransactions((list) => list.filter((t) => t.id !== pendingDelete.id));
    toast.success("Transaction deleted");
    setPendingDelete(null);
  };

  return (
    <AppShell activeKey="transactions" userName={mockUser.name} notificationCount={mockNotificationCount}>
      <PageContainer>
        <PageHeader
          title="Financial Activity"
          description="Real-time analysis of your spending across all connected accounts."
          actions={
            <>
              <Button variant="surface" size="control" className="max-md:hidden">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button variant="brand" size="control" onClick={openAdd} className="max-md:w-full">
                <Plus className="h-4 w-4" />
                Add Transaction
              </Button>
            </>
          }
        />

        <TransactionFilters
          value={filters}
          onChange={updateFilters}
          onReset={resetFilters}
          categories={mockCategories}
          types={mockTransactionTypes}
          dateRangeLabel="Oct 1 – Oct 31"
          activeFilterCount={activeFilterCount}
          mobileFiltersOpen={mobileFiltersOpen}
          onMobileFiltersOpenChange={setMobileFiltersOpen}
        />

        {pageItems.length === 0 ? (
          <div className="nexali-panel mb-6 rounded-xl md:mb-8">
            <EmptyState
              icon={Receipt}
              title={isFiltering ? "No matching transactions" : "No transactions yet"}
              description={
                isFiltering
                  ? "Try a different search term or clear your filters to see more activity."
                  : "Once activity lands in your connected accounts, it will show up here."
              }
              action={
                isFiltering ? (
                  <Button variant="surface" size="control" onClick={resetFilters}>
                    Reset filters
                  </Button>
                ) : (
                  <Button variant="brand" size="control" onClick={openAdd}>
                    <Plus className="h-4 w-4" />
                    Add Transaction
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="mb-4 grid gap-2 md:hidden">
              {pageItems.map((t) => (
                <TransactionCard
                  key={t.id}
                  transaction={t}
                  onEdit={openEdit}
                  onDelete={setPendingDelete}
                />
              ))}
            </ul>

            {/* Tablet + desktop: table */}
            <div className="nexali-panel mb-4 hidden overflow-hidden rounded-xl md:block md:mb-8">
              <TransactionTable
                transactions={pageItems}
                onEdit={openEdit}
                onDelete={setPendingDelete}
              />
              <TransactionPagination
                page={currentPage}
                pageCount={pageCount}
                rangeStart={(currentPage - 1) * PAGE_SIZE + 1}
                rangeEnd={(currentPage - 1) * PAGE_SIZE + pageItems.length}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>

            <div className="nexali-panel mb-6 overflow-hidden rounded-xl md:hidden">
              <TransactionPagination
                page={currentPage}
                pageCount={pageCount}
                rangeStart={(currentPage - 1) * PAGE_SIZE + 1}
                rangeEnd={(currentPage - 1) * PAGE_SIZE + pageItems.length}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <DailyBurnCard
            amount={mockSpendingInsights.averageDailyBurn}
            changePercent={mockSpendingInsights.changePercent}
            sparkline={mockSpendingInsights.sparkline}
          />
          <TopCategoriesCard categories={mockSpendingInsights.topCategories} />
        </div>
      </PageContainer>

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editing}
        categories={mockCategories}
        types={mockTransactionTypes}
        onSubmit={handleSubmit}
      />

      <DeleteTransactionDialog
        transaction={pendingDelete}
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}
