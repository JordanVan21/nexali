import { cn } from "@/lib/utils";

export function BrandMark({
  showWordmark = true,
  className,
}: {
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19V5l14 14V5" />
        </svg>
      </span>
      {showWordmark && (
        <span className="font-display truncate text-[20px] font-bold tracking-tight text-foreground">
          Nexali
        </span>
      )}
      <span className="sr-only">Nexali</span>
    </div>
  );
}
