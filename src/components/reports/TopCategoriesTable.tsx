import { getCategoryIcon } from "../../lib/categoryIcon";
import { useFormatCurrency } from "../../features/profiles/useFormatPreferences";
import { percentChange } from "../../lib/financialAnalytics";
import { cn } from "../../lib/utils";
import type { CategoryAmount } from "../../lib/financialAnalytics";

const TONES = [
  { icon: "bg-primary/10 text-primary" },
  { icon: "bg-success/10 text-success" },
  { icon: "bg-warning/10 text-warning" },
  { icon: "bg-destructive/10 text-destructive" },
];

function ChangeBadge({ current, previous, comparisonLabel }: { current: number; previous: number | undefined; comparisonLabel: string }) {
  const change = previous !== undefined ? percentChange(current, previous) : null;
  if (change === null) {
    return <span className="text-xs text-muted-foreground">No data for {comparisonLabel}</span>;
  }
  const up = change >= 0;
  return (
    <span className={cn("text-xs font-medium", up ? "text-destructive" : "text-success")}>
      {up ? "+" : ""}
      {change.toFixed(1)}% vs {comparisonLabel}
    </span>
  );
}

/**
 * Real expense categories ranked by amount for the selected period, with a
 * real vs-previous-period change per category (never an all-time ranking
 * presented as period data — see useReportsData.ts). Desktop renders a real
 * table; mobile/tablet renders the same rows as a card list.
 */
export function TopCategoriesTable({
  categories,
  previousCategories,
  comparisonLabel,
}: {
  categories: CategoryAmount[];
  previousCategories: CategoryAmount[];
  comparisonLabel: string;
}) {
  const formatCurrency = useFormatCurrency();
  const previousById = new Map(previousCategories.map((c) => [c.id, c.amount]));

  if (categories.length === 0) {
    return (
      <div className="nexali-panel rounded-xl p-6 text-center text-sm text-muted-foreground">
        No expenses recorded for this period.
      </div>
    );
  }

  return (
    <div className="nexali-panel overflow-hidden rounded-xl">
      <div className="border-b border-outline-variant p-4 sm:p-6">
        <h3 className="font-display text-lg font-semibold text-foreground lg:text-xl xl:text-2xl">Top Categories</h3>
      </div>

      {/* Mobile/tablet: card list */}
      <ul className="divide-y divide-outline-variant md:hidden">
        {categories.map((c, i) => {
          const Icon = getCategoryIcon(c.label);
          const tone = TONES[i % TONES.length];
          return (
            <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", tone.icon)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{c.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.count} transaction{c.count === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="numeric font-medium text-foreground">{formatCurrency(c.amount)}</p>
                <ChangeBadge current={c.amount} previous={previousById.get(c.id)} comparisonLabel={comparisonLabel} />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: real table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Top spending categories</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {categories.map((c, i) => {
              const Icon = getCategoryIcon(c.label);
              const tone = TONES[i % TONES.length];
              return (
                <tr key={c.id} className="transition-colors hover:bg-surface-high/40">
                  <td className="p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", tone.icon)}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{c.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.count} transaction{c.count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <p className="numeric font-medium text-foreground">{formatCurrency(c.amount)}</p>
                    <ChangeBadge current={c.amount} previous={previousById.get(c.id)} comparisonLabel={comparisonLabel} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
