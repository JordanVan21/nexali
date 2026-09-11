import { useEffect, useRef, useState } from "react";
import { useUserInfo } from "../shared/useUserId";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { format } from "date-fns";
import { useTransactions } from "../features/transactions/useTransactions";
import { useTransactionCounts } from "../lib/transactions";
import { CategoryFilterDropdown } from "./CategoryFilterDropdown";
import { hasActiveFilters, type Filters } from "../features/querykeys";

const SEARCH_DEBOUNCE_MS = 350;

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

  const dateRange = {
    from: filters.fromISO ? new Date(filters.fromISO) : undefined,
    to: filters.toISO ? new Date(filters.toISO) : undefined,
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
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="h-4 w-4" aria-hidden="true" />
            <span>
              {dateRange.from
                ? dateRange.to
                  ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                  : format(dateRange.from, "MMM dd, yyyy")
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
              if (range?.from && range?.to) {
                updateFilters({ fromISO: range.from.toISOString(), toISO: range.to.toISOString() });
              } else if (
                range?.from &&
                tempDateRange.from &&
                range.from.getTime() === tempDateRange.from.getTime()
              ) {
                updateFilters({ fromISO: range.from.toISOString(), toISO: range.from.toISOString() });
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
                    fromISO: tempDateRange.from!.toISOString(),
                    toISO: tempDateRange.from!.toISOString(),
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
          <Button variant="outline" size="sm" className="gap-2">
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
          <Button variant="outline" size="sm" className="gap-2">
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
          <Button variant="outline" size="sm" className="gap-2">
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
          <Button variant="outline" size="sm" className="gap-2">
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
    <div className="space-y-3 rounded-xl border border-border/20 bg-gradient-card p-4 shadow-card sm:p-5">
      {/* One integrated toolbar row on tablet/desktop: search grows, filters
          and Reset sit inline to its right, matching the approved reference
          ([ Search.......... ][Category][Type][Date][Reset]). Mobile keeps
          search on its own row above the filter sheet trigger. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm md:flex-1">
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
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Desktop/tablet: filters inline. Hidden below md via CSS, not a JS isMobile check. */}
          <div className="hidden flex-wrap items-center gap-2 md:flex">{renderFilters()}</div>

          {/* Mobile: secondary filters collapse into a sheet. */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
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
              </SheetContent>
            </Sheet>
          </div>

          {activeFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-primary hover:text-primary">
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Reset Filters</span>
            </Button>
          )}
        </div>
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
          {filters.fromISO && (
            <Badge variant="default" className="gap-1 text-xs">
              {filters.toISO
                ? `${format(new Date(filters.fromISO), "MMM dd")} - ${format(new Date(filters.toISO), "MMM dd")}`
                : format(new Date(filters.fromISO), "MMM dd, yyyy")}
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
