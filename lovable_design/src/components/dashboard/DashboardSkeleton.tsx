import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[152px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-[340px] rounded-xl md:col-span-2" />
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-[300px] rounded-xl md:col-span-2" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    </div>
  );
}
