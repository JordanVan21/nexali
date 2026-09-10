import { Fragment, useEffect, useState } from "react";
import { TransactionNavbar } from "./TransactionFilterBar.tsx";
import Modal from "./Modal.tsx";
import { useDeleteTransaction } from "../features/transactions/useTransactions.ts";
import { type TransactionWithCat, type TxId } from "../lib/transactions.ts";
import { Button } from "./ui/button.tsx";
import { useUserInfo } from "../shared/useUserId.ts";
import { useIsMobile } from "../hooks/useMobile.tsx";
import { Card, CardContent } from "./ui/card.tsx";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table.tsx";
import { type Filters } from "../features/querykeys.ts";
import { useTransactionWithFilters } from "../features/transactions/useTransactions.ts";

interface TableProps {
  itemsPerPage?: number;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

function TransactionTable({ itemsPerPage = 10, filters, onFiltersChange }: TableProps) {
  const [activeId, setActiveId] = useState<TxId | null>(null);
  const [editingTx, setEditingTx] = useState<TransactionWithCat | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(itemsPerPage);

  const { userId } = useUserInfo();
  const isMobile = useIsMobile();

  const txQuery = useTransactionWithFilters(userId, filters)
    
  const delTx = useDeleteTransaction(userId);

  const handleRowClick = (id: TxId) =>
    setActiveId((prev) => (prev === id ? null : id));

  const handleEdit = (tx: TransactionWithCat) => {
    setEditingTx(tx);
  };

  useEffect(() => {
    const dlg = document.getElementById(
      "edit_modal"
    ) as HTMLDialogElement | null;
    if (!dlg) return;

    try {
      if (editingTx && !dlg.open) {
        dlg.showModal();
      } else if (!editingTx && dlg.open) {
        dlg.close();
      }
    } catch (e) {
      console.warn("Dialog open/close race:", e);
    }
  }, [editingTx]);

  // Accept TxId, not string
  const handleDelete = (id: TxId) => {
    if (!confirm("Delete this transaction?")) return;
    delTx.mutate(id, {
      onSuccess: () => setActiveId(null),
      onError: (e) => alert(e.message || "Delete failed"),
    });
  };

  if (txQuery.isLoading)
    return <div className="p-4 text-base-content">Loading transactions…</div>;
  if (txQuery.isError) {
    return (
      <div className="p-4 text-destructive">
        {txQuery.error?.message ?? "Failed to load transactions"}
      </div>
    );
  }

  const transactions = (txQuery.data ?? []) as TransactionWithCat[];

  const totalPages = Math.ceil(transactions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setActiveId(null);
  };

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1);
    setActiveId(null);
  };

  const MobileTransactionCard = ({
    tx,
    index,
  }: {
    tx: TransactionWithCat;
    index: number;
  }) => {
    const isExpanded = activeId === tx.id;

    return (
      <Card className="mb-3 border-border/20 bg-card/50">
        <CardContent className="p-4">
          <div className="cursor-pointer" onClick={() => handleRowClick(tx.id)}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="font-medium text-foreground text-sm">
                  {tx.categories?.name ?? "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  #{startIndex + index + 1} • {tx.categories?.type ?? "Unknown"}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground">
                  ${tx.amount}
                </div>
                <div className="text-xs text-muted-foreground">
                  {tx.created_at
                    ? new Date(tx.created_at).toLocaleDateString()
                    : ""}
                </div>
              </div>
            </div>
            {tx.note && (
              <div className="text-sm text-muted-foreground bg-accent/20 rounded-md p-2 mt-2">
                {tx.note}
              </div>
            )}
          </div>

          {isExpanded && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border/20">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleEdit(tx)}
                className="flex-1 gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(tx.id);
                }}
                disabled={delTx.isPending}
                className="flex-1 gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {delTx.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const PaginationControls = () => (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 px-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Show</span>
        <Select
          value={pageSize.toString()}
          onValueChange={handlePageSizeChange}
        >
          <SelectTrigger className="w-20 h-8">
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

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {startIndex + 1}-{Math.min(endIndex, transactions.length)} of{" "}
          {transactions.length}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(pageNum)}
                className="h-8 w-8 p-0"
              >
                {pageNum}
              </Button>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <TransactionNavbar
        filters={filters}
        onFiltersChange={onFiltersChange}
        onTxCreated={async () => {
          await txQuery.refetch();
        }}
      />
      <Modal
        tx={editingTx}
        dialogId="edit_modal"
        onTxCreated={async () => {
          await txQuery.refetch();
        }}
        onClose={() => setEditingTx(null)}
        showTrigger={false}
      />

      <div className="p-4 sm:p-6">
        {transactions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <div>No transactions yet</div>
            <div>Add your first transaction to get started</div>
          </div>
        ) : (
          <>
            {isMobile ? (
              <div>
                {currentTransactions.map((tx, index) => (
                  <MobileTransactionCard key={tx.id} tx={tx} index={index} />
                ))}
              </div>
            ) : (
              <div className="border border-border/20 rounded-lg overflow-hidden bg-card/30">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="min-w-[200px]">Note</TableHead>
                      <TableHead className="min-w-[150px]">Merchant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-32">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentTransactions.map((tx, index) => {
                      const isExpanded = activeId === tx.id;
                      return (
                        <Fragment key={tx.id}>
                          <TableRow
                            onClick={() => handleRowClick(tx.id)}
                            className={`cursor-pointer transition-colors duration-200 ${
                              isExpanded ? "bg-accent/20" : "hover:bg-accent/10"
                            }`}
                          >
                            <TableCell className="font-mono text-sm">
                              {startIndex + index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {tx.categories?.name ?? "Unknown"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[300px] truncate">
                                {tx.note || "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {" "}
                              <div className="max-w-[200px] truncate">
                                {tx.merchant || "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  tx.categories?.type === "income"
                                    ? "bg-green-500/10 text-green-500"
                                    : "bg-red-500/10 text-red-500"
                                }`}
                              >
                                {tx.categories?.type ?? "Unknown"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${tx.amount}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {tx.created_at
                                ? new Date(tx.created_at).toLocaleDateString()
                                : "—"}
                            </TableCell>
                          </TableRow>

                          {isExpanded && (
                            <TableRow className="bg-accent/10">
                              <TableCell colSpan={7} className="py-4">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleEdit(tx)}
                                    className="gap-2"
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(tx.id);
                                    }}
                                    disabled={delTx.isPending}
                                    className="gap-2"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {delTx.isPending ? "Deleting…" : "Delete"}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <PaginationControls />
          </>
        )}
      </div>
    </div>
  );
}

export default TransactionTable;
