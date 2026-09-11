import { useState } from "react";
import { Edit, Trash2, TrendingDown, TrendingUp, Receipt, SearchX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useDeleteTransaction, useTransactionWithFilters } from "../features/transactions/useTransactions";
import { type TransactionWithCat } from "../lib/transactions";
import { hasActiveFilters, type Filters } from "../features/querykeys";
import { useUserInfo } from "../shared/useUserId";
import { formatCurrency } from "../lib/format";
import { getCategoryIcon } from "../lib/categoryIcon";
import { getErrorMessage, cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Skeleton } from "./states/Skeleton";
import { EmptyState } from "./states/EmptyState";
import { ErrorState } from "./states/ErrorState";
import { ConfirmDialog } from "./ConfirmDialog";
import { MobileTransactionCard } from "./MobileTransactionCard";

interface TransactionTableProps {
  itemsPerPage?: number;
  filters: Filters;
  onAddTransaction: () => void;
  onEditTransaction: (tx: TransactionWithCat) => void;
}

/** Up to 5 page numbers centered around the current page. */
function visiblePageNumbers(currentPage: number, totalPages: number): number[] {
  const count = Math.min(totalPages, 5);
  let start = 1;
  if (totalPages > 5) {
    if (currentPage <= 3) start = 1;
    else if (currentPage >= totalPages - 2) start = totalPages - 4;
    else start = currentPage - 2;
  }
  return Array.from({ length: count }, (_, i) => start + i);
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4 sm:p-6" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function TransactionTable({
  itemsPerPage = 10,
  filters,
  onAddTransaction,
  onEditTransaction,
}: TransactionTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(itemsPerPage);
  const [pendingDelete, setPendingDelete] = useState<TransactionWithCat | null>(null);

  const { userId } = useUserInfo();
  const txQuery = useTransactionWithFilters(userId, filters);
  const delTx = useDeleteTransaction(userId);

  const transactions = (txQuery.data ?? []) as TransactionWithCat[];
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => setCurrentPage(page);
  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize, 10));
    setCurrentPage(1);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    delTx.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
    });
  };

  if (txQuery.isLoading) {
    return <TableSkeleton />;
  }

  if (txQuery.isError) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          title="Couldn't load transactions"
          message={getErrorMessage(txQuery.error, "Please check your connection and try again.")}
          onRetry={() => txQuery.refetch()}
        />
      </div>
    );
  }

  if (transactions.length === 0) {
    const filtered = hasActiveFilters(filters);
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          icon={filtered ? SearchX : Receipt}
          title={filtered ? "No transactions match these filters" : "No transactions yet"}
          description={
            filtered
              ? "Try widening your search or clearing a filter to see more results."
              : "Add your first transaction to start tracking your spending."
          }
          action={
            !filtered && (
              <Button variant="hero" onClick={onAddTransaction}>
                Add Transaction
              </Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div>
      {/* Mobile: card list. Hidden at md and above via CSS, not JS, so there's no render-time flash of the wrong layout. */}
      <ul className="space-y-3 p-4 md:hidden">
        {currentTransactions.map((tx) => (
          <MobileTransactionCard
            key={tx.id}
            tx={tx}
            onEdit={onEditTransaction}
            onDelete={setPendingDelete}
          />
        ))}
      </ul>

      {/* Tablet/desktop: table. The bordered card surface itself is owned by
          the page (Transactions.tsx) so the header, rows, and footer below
          read as one integrated surface, matching the approved reference,
          instead of a table-in-a-card-in-a-card. */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-28">Date</TableHead>
              <TableHead className="min-w-[200px]">Merchant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentTransactions.map((tx) => {
              const isIncome = tx.categories?.type === "income";
              const categoryName = tx.categories?.name ?? "Uncategorized";
              const amountLabel = `${isIncome ? "+" : "-"}${formatCurrency(Math.abs(tx.amount))}`;
              const MerchantIcon = getCategoryIcon(categoryName);

              return (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-foreground/80"
                        aria-hidden="true"
                      >
                        <MerchantIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="max-w-[240px] truncate font-medium text-foreground">
                          {tx.merchant || categoryName}
                        </div>
                        {tx.note && (
                          <div className="max-w-[240px] truncate text-xs text-muted-foreground">
                            {tx.note}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border border-border/40 bg-accent/20 px-2 py-0.5 text-xs font-medium text-foreground">
                      {categoryName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-sm font-medium",
                        isIncome ? "text-success" : "text-destructive"
                      )}
                    >
                      {isIncome ? (
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {isIncome ? "Income" : "Expense"}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold [font-variant-numeric:tabular-nums]",
                      isIncome ? "text-success" : "text-destructive"
                    )}
                  >
                    {amountLabel}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit transaction: ${tx.merchant || categoryName}, ${amountLabel}`}
                        onClick={() => onEditTransaction(tx)}
                      >
                        <Edit className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        aria-label={`Delete transaction: ${tx.merchant || categoryName}, ${amountLabel}`}
                        onClick={() => setPendingDelete(tx)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer: same surface as the table/list above it, per the
          approved reference (range/count left, pagination right). */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-border/20 px-4 py-3 sm:flex-row md:px-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {startIndex + 1}-{Math.min(endIndex, transactions.length)} of {transactions.length}
          </span>
          <div className="hidden items-center gap-2 sm:flex">
            <span aria-hidden="true">·</span>
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-7 w-16 text-xs" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>per page</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="First page"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          {visiblePageNumbers(currentPage, totalPages).map((pageNum) => (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? "default" : "ghost"}
              size="icon"
              aria-label={`Page ${pageNum}`}
              aria-current={currentPage === pageNum ? "page" : undefined}
              onClick={() => handlePageChange(pageNum)}
            >
              {pageNum}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Last page"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete transaction?"
        description={
          pendingDelete
            ? `This will permanently delete the ${formatCurrency(pendingDelete.amount)} ${
                pendingDelete.merchant || pendingDelete.categories?.name || "transaction"
              } entry. This can't be undone.`
            : ""
        }
        onConfirm={confirmDelete}
        isPending={delTx.isPending}
        errorMessage={delTx.isError ? getErrorMessage(delTx.error, "Failed to delete transaction.") : null}
      />
    </div>
  );
}
