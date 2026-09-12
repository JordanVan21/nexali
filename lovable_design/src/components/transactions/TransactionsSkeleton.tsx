import { Skeleton } from "@/components/ui/skeleton";

export function TransactionsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-outline-variant/30" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading transactions…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 lg:px-6">
          <Skeleton className="h-10 w-10 rounded-lg bg-surface-high" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-40 bg-surface-high" />
            <Skeleton className="h-3 w-24 bg-surface-high" />
          </div>
          <Skeleton className="h-4 w-20 bg-surface-high" />
        </div>
      ))}
    </div>
  );
}
