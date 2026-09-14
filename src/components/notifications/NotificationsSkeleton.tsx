import { Skeleton } from "../states/Skeleton";

/** Shaped like the real Notifications feed so nothing shifts once data arrives. */
export function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading notifications">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[84px] rounded-xl" />
      ))}
    </div>
  );
}
