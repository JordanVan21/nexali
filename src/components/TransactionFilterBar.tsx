import { useEffect, useRef, useState } from "react";
import { useUserInfo } from "../shared/useUserId";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./ui/dropdownMenu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import {
  Search,
  Filter,
  Calendar as CalendarIcon,
  SortAsc,
  X,
  DollarSign,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
} from "lucide-react";
import { useTransactions } from "../features/transactions/useTransactions";
import { useProfile } from "../features/profiles/useProfile";
import { useTransactionCounts } from "../lib/transactions";
import { CategoryFilterDropdown } from "./CategoryFilterDropdown";
import { hasActiveFilters, type Filters } from "../features/querykeys";
import { zonedTimeToUtc, browserTimeZone } from "../lib/timezone";

const SEARCH_DEBOUNCE_MS = 350;

/** The real UTC instant for local midnight on `date`'s calendar day, in `timeZone` -- the inclusive lower bound of a date-range filter. */
function startOfDayIso(date: Date, timeZone: string): string {
  return zonedTimeToUtc({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }, timeZone, 0, 0, 0).toISOString();
}

/** The real UTC instant for local midnight on the day AFTER `date`, in `timeZone` -- the exclusive upper bound needed to include the WHOLE of `date`'s calendar day (applyTransactionFilters uses `.lt("occurred_at", toISO)`). */
function startOfNextDayIso(date: Date, timeZone: string): string {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return startOfDayIso(next, timeZone);
}

/** "MMM dd" (or "MMM dd, yyyy") in `timeZone`, matching the date-range control's previous date-fns-based display format, but timezone-correct. */
function formatShort(date: Date, timeZone: string, withYear = false): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "2-digit",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(date);
}

interface TransactionFilterBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function TransactionFilterBar({ filters, onFiltersChange }: TransactionFilterBarProps) {
  const [minAmountInput, setMinAmountInput] = useState(filters.minAmount?.toString() || "");
  const [maxAmountInput, setMaxAmountInput] = useState(filters.maxAmount?.toString() || "");
  const [searchInput, setSearchInput] = useState(filters.search || "");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { userId } = useUserInfo();
  const { data: transactions = [] } = useTransactions(userId);
  const categoryTransactionCounts = useTransactionCounts(transactions);
  const profile = useProfile(userId);
  // The real financial timezone (profiles.timezone) -- date-range filter
  // boundaries must be computed relative to this, not the browser's own
  // timezone, so a selected day always includes exactly that CALENDAR day
  // in the user's configured financial timezone. See
  // docs/BACKEND_AUDIT_REPORT.md Backend Part 4.
  const timeZone = profile.data?.timezone ?? browserTimeZone();

  const updateFilters = (updates: Partial<Filters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  // Debounced live search (Master Spec's "Debounce search" performance
  // requirement) with cleanup so a pending update never fires after unmount.
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      updateFilters({ search: value.trim() || undefined });
    }, SEARCH_DEBOUNCE_MS);
  };
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // filters.toISO is the EXCLUSIVE upper bound (start of the day after the
  // selected end date -- see startOfNextDayIso), so the displayed "to" date
  // is one day earlier than the stored instant. A plain 24h subtraction is
  // safe for a display label even across a DST transition, since the
  // month/day formatting below ignores time-of-day.
  const dateRange = {
    from: filters.fromISO ? new Date(filters.fromISO) : undefined,
    to: filters.toISO ? new Date(new Date(filters.toISO).getTime() - 24 * 60 * 60 * 1000) : undefined,
  };

  const [tempDateRange, setTempDateRange] = useState<{ from?: Date; to?: Date }>({
    from: dateRange.from,
    to: dateRange.to,
  });

  const clearFilters = () => {
    onFiltersChange({
      search: undefined,
      fromISO: undefined,
      toISO: undefined,
      categoryIds: undefined,
      categoryNames: undefined,
      types: undefined,
      minAmount: undefined,
      maxAmount: undefined,
      sortBy: "date",
      sortOrder: "desc",
      limit: undefined,
      offset: undefined,
    });
    setSearchInput("");
    setMinAmountInput("");
    setMaxAmountInput("");
    setTempDateRange({});
  };

  const activeFilters = hasActiveFilters(filters);

  const handleAmountBlur = (type: "min" | "max", value: string) => {
    const numericValue = value ? parseFloat(value) : undefined;
    updateFilters(type === "min" ? { minAmount: numericValue } : { maxAmount: numericValue });
  };

  const renderFilters = () => (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="surface" size="control" className="gap-2">
            <CalendarIcon className="h-4 w-4" aria-hidden="true" />
            <span>
              {dateRange.from
                ? dateRange.to
                  ? `${formatShort(dateRange.from, timeZone)} - ${formatShort(dateRange.to, timeZone)}`
                  : formatShort(dateRange.from, timeZone, true)
                : "Date Range"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto border-border bg-background p-0 shadow-lg" align="start">
          <Calendar
            mode="range"
            selected={{ from: tempDateRange.from, to: tempDateRange.to }}
            onSelect={(range) => {
              setTempDateRange({ from: range?.from, to: range?.to });
              // fromISO/toISO are a half-open [start of `from`'s day, start
              // of the day AFTER `to`'s day) range in the user's configured
              // timezone, so the END date is genuinely included -- matching
              // applyTransactionFilters' `.lt("occurred_at", toISO)`.
              if (range?.from && range?.to) {
                updateFilters({ fromISO: startOfDayIso(range.from, timeZone), toISO: startOfNextDayIso(range.to, timeZone) });
              } else if (
                range?.from &&
                tempDateRange.from &&
                range.from.getTime() === tempDateRange.from.getTime()
              ) {
                updateFilters({ fromISO: startOfDayIso(range.from, timeZone), toISO: startOfNextDayIso(range.from, timeZone) });
              }
            }}
            numberOfMonths={1}
          />
          <div className="flex gap-2 border-t p-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTempDateRange({});
                updateFilters({ fromISO: undefined, toISO: undefined });
              }}
            >
              Clear
            </Button>
            {tempDateRange.from && !tempDateRange.to && (
              <Button
                size="sm"
                onClick={() =>
                  updateFilters({
                    fromISO: startOfDayIso(tempDateRange.from!, timeZone),
                    toISO: startOfNextDayIso(tempDateRange.from!, timeZone),
                  })
                }
              >
                Select Single Date
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="surface" size="control" className="gap-2">
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span>Category</span>
            {(filters.categoryNames?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                {filters.categoryNames?.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <CategoryFilterDropdown
          userId={userId}
          selectedCategories={filters.categoryNames || []}
          setSelectedCategories={(categoriesOrUpdater) => {
            const newCategories =
              typeof categoriesOrUpdater === "function"
                ? categoriesOrUpdater(filters.categoryNames || [])
                : categoriesOrUpdater;
            updateFilters({ categoryNames: newCategories });
          }}
          categoryTransactionCounts={categoryTransactionCounts}
        />
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="surface" size="control" className="gap-2">
            <DollarSign className="h-4 w-4" aria-hidden="true" />
            <span>Type</span>
            {(filters.types?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                {filters.types?.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Transaction Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateFilters({ types: [] })}>Clear Selection</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => {
              const currentTypes = filters.types || [];
              updateFilters({
                types: currentTypes.includes("income")
                  ? currentTypes.filter((t) => t !== "income")
                  : [...currentTypes, "income"],
              });
            }}
          >
            <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
            Income {filters.types?.includes("income") && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => {
              const currentTypes = filters.types || [];
              updateFilters({
                types: currentTypes.includes("expense")
                  ? currentTypes.filter((t) => t !== "expense")
                  : [...currentTypes, "expense"],
              });
            }}
          >
            <TrendingDown className="h-4 w-4 text-destructive" aria-hidden="true" />
            Expense {filters.types?.includes("expense") && "✓"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="surface" size="control" className="gap-2">
            <DollarSign className="h-4 w-4" aria-hidden="true" />
            <span>Amount</span>
            {(filters.minAmount !== undefined || filters.maxAmount !== undefined) && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                •
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Amount Range</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="min-amount" className="text-xs text-muted-foreground">
                  Min
                </label>
                <Input
                  id="min-amount"
                  type="number"
                  placeholder="0"
                  value={minAmountInput}
                  onChange={(e) => setMinAmountInput(e.target.value)}
                  onBlur={() => handleAmountBlur("min", minAmountInput)}
                  onKeyDown={(e) => e.key === "Enter" && handleAmountBlur("min", minAmountInput)}
                />
              </div>
              <div>
                <label htmlFor="max-amount" className="text-xs text-muted-foreground">
                  Max
                </label>
                <Input
                  id="max-amount"
                  type="number"
                  placeholder="1000"
                  value={maxAmountInput}
                  onChange={(e) => setMaxAmountInput(e.target.value)}
                  onBlur={() => handleAmountBlur("max", maxAmountInput)}
                  onKeyDown={(e) => e.key === "Enter" && handleAmountBlur("max", maxAmountInput)}
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="surface" size="control" className="gap-2">
            <SortAsc className="h-4 w-4" aria-hidden="true" />
            <span>Sort</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateFilters({ sortBy: "date" })}>
            Date {filters.sortBy === "date" && `(${filters.sortOrder || "desc"})`}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateFilters({ sortBy: "amount" })}>
            Amount {filters.sortBy === "amount" && `(${filters.sortOrder || "desc"})`}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateFilters({ sortBy: "category" })}>
            Category {filters.sortBy === "category" && `(${filters.sortOrder || "desc"})`}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => updateFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
          >
            {filters.sortOrder === "asc" ? "Descending" : "Ascending"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <div className="nexali-panel space-y-4 rounded-xl p-3">
      {/* Row 1, every breakpoint: Search is the primary, full-width control
          in its own row, matching the Lovable reference. Mobile pairs it
          with the Filters sheet trigger; tablet/desktop get their own
          second row of filter chips below. */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="transaction-search" className="sr-only">
            Search transactions by merchant or note
          </label>
          <Input
            id="transaction-search"
            type="search"
            placeholder="Search by merchant or note…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-11 pl-9"
          />
        </div>

        {/* Mobile: secondary filters collapse into a sheet, triggered next to Search. */}
        <div className="shrink-0 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="surface" size="control" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filters
                {activeFilters && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                    •
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filter Transactions</SheetTitle>
                <SheetDescription>Narrow down your transaction list.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 flex flex-col items-start gap-3">{renderFilters()}</div>
              <SheetFooter className="mt-6 flex-row gap-2">
                {activeFilters && (
                  <Button type="button" variant="surface" size="control" className="flex-1" onClick={clearFilters}>
                    Reset Filters
                  </Button>
                )}
                <SheetClose asChild>
                  <Button type="button" variant="hero" size="control" className="flex-1">
                    Show results
                  </Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Row 2, tablet/desktop only: real filter controls + Reset. Hidden
          below md via CSS, not a JS isMobile check. */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {renderFilters()}
        {activeFilters && (
          <Button variant="link" onClick={clearFilters} className="px-2 text-sm">
            Reset Filters
          </Button>
        )}
      </div>

      {activeFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {filters.categoryNames?.map((category) => (
            <Badge key={category} variant="default" className="gap-1 text-xs">
              {category}
              <button
                type="button"
                aria-label={`Remove category filter: ${category}`}
                onClick={() =>
                  updateFilters({ categoryNames: filters.categoryNames?.filter((c) => c !== category) })
                }
                className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          {filters.types?.map((type) => (
            <Badge key={type} variant="default" className="gap-1 text-xs capitalize">
              {type}
              <button
                type="button"
                aria-label={`Remove type filter: ${type}`}
                onClick={() => updateFilters({ types: filters.types?.filter((t) => t !== type) })}
                className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          {dateRange.from && (
            <Badge variant="default" className="gap-1 text-xs">
              {dateRange.to
                ? `${formatShort(dateRange.from, timeZone)} - ${formatShort(dateRange.to, timeZone)}`
                : formatShort(dateRange.from, timeZone, true)}
              <button
                type="button"
                aria-label="Remove date filter"
                onClick={() => {
                  setTempDateRange({});
                  updateFilters({ fromISO: undefined, toISO: undefined });
                }}
                className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          )}
          {(filters.minAmount !== undefined || filters.maxAmount !== undefined) && (
            <Badge variant="default" className="gap-1 text-xs">
              ${filters.minAmount ?? "0"} - ${filters.maxAmount ?? "∞"}
              <button
                type="button"
                aria-label="Remove amount filter"
                onClick={() => {
                  updateFilters({ minAmount: undefined, maxAmount: undefined });
                  setMinAmountInput("");
                  setMaxAmountInput("");
                }}
                className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
