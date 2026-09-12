import { Skeleton } from "@/components/ui/skeleton";

export function BudgetsSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8" aria-busy="true" aria-label="Loading budgets">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[220px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
