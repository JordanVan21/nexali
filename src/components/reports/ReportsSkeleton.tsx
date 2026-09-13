import { Skeleton } from "../states/Skeleton";

/** Shaped like the real Reports layout so nothing shifts once data arrives. */
export function ReportsSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8" aria-busy="true" aria-label="Loading reports">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <Skeleton className="h-[360px] rounded-xl md:col-span-8" />
        <Skeleton className="h-[360px] rounded-xl md:col-span-4" />
      </div>
      <Skeleton className="h-[320px] rounded-xl" />
      <Skeleton className="h-[280px] rounded-xl" />
      <Skeleton className="h-[220px] rounded-xl" />
    </div>
  );
}
