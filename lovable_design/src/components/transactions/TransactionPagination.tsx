import { ChevronLeft, ChevronRight } from "lucide-react";

export type TransactionPaginationProps = {
  page: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function TransactionPagination({
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
}: TransactionPaginationProps) {
  return (
    <nav
      aria-label="Transactions pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/50 bg-surface-low/30 px-4 py-3 lg:px-6"
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="numeric">{rangeStart}</span>–<span className="numeric">{rangeEnd}</span> of{" "}
        <span className="numeric">{total}</span> transactions
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="numeric px-2 text-sm text-muted-foreground">
          {page} / {Math.max(pageCount, 1)}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}
