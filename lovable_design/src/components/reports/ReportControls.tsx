import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportPeriod } from "@/mock/reports";

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "12m", label: "12 Months" },
  { value: "6m", label: "6 Months" },
  { value: "30d", label: "30 Days" },
];

export function ReportControls({
  period,
  onPeriodChange,
  category,
  onCategoryChange,
  categories,
  onExport,
}: {
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div
        role="group"
        aria-label="Report period"
        className="flex rounded-lg border border-outline-variant bg-surface p-1"
      >
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={period === opt.value}
            onClick={() => onPeriodChange(opt.value)}
            className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
              period === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger
          aria-label="Filter by category"
          className="h-11 w-[160px] rounded-lg border-outline-variant bg-surface-lowest text-sm"
        >
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="surface" size="control" onClick={onExport}>
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
    </div>
  );
}
