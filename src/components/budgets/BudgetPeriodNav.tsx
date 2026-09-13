import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Real month navigation for the Budgets page: moves between actual
 * budget periods (month/year), filtering the same real budget rows —
 * addresses docs/AUDIT_REPORT.md P3 ("budgets from all periods listed
 * together with no period navigation"). Never a decorative control: every
 * click changes which period's real budgets/spend are displayed.
 */
export function BudgetPeriodNav({
  month,
  year,
  onChange,
}: {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}) {
  const goToPrevious = () => {
    if (month === 1) onChange(12, year - 1);
    else onChange(month - 1, year);
  };

  const goToNext = () => {
    if (month === 12) onChange(1, year + 1);
    else onChange(month + 1, year);
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:justify-start">
      <Button type="button" variant="outline" size="icon" aria-label="Previous month" onClick={goToPrevious}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span className="min-w-[10rem] text-center text-sm font-medium text-foreground">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button type="button" variant="outline" size="icon" aria-label="Next month" onClick={goToNext}>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
