import { Download } from "lucide-react";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "../../lib/utils";
import { REPORT_PERIODS, type ReportPeriodOption } from "../../features/reports/useReportsData";

export function ReportsControls({
  period,
  onPeriodChange,
  category,
  onCategoryChange,
  categories,
  onExport,
  exportDisabled,
}: {
  period: ReportPeriodOption;
  onPeriodChange: (period: ReportPeriodOption) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
  onExport: () => void;
  exportDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div role="group" aria-label="Report period" className="flex rounded-lg border border-outline-variant bg-surface p-1">
        {REPORT_PERIODS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={period === opt.value}
            onClick={() => onPeriodChange(opt.value)}
            className={cn(
              "min-h-9 rounded-md px-3 text-sm font-medium transition-colors",
              period === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger aria-label="Filter by category" className="h-11 w-[160px] rounded-lg border-outline-variant bg-surface-lowest text-sm">
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

      <Button
        type="button"
        variant="surface"
        size="control"
        onClick={onExport}
        disabled={exportDisabled}
        title={exportDisabled ? "No transactions in this period to export" : "Export the transactions shown below as CSV"}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export CSV
      </Button>
    </div>
  );
}
