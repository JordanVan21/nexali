import Modal from "./Modal";
import { useUserInfo } from "../shared/useUserId";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { useIsMobile } from "../hooks/useMobile";
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
  Menu,
} from "lucide-react";
import { format } from "date-fns";
import { useTransactions } from "../features/transactions/useTransactions";
import { useTransactionCounts } from "../lib/transactions";
import { CategoryFilterDropdown } from "./CategoryFilterDropdown";
import { type Filters } from "../features/querykeys";

interface TransactionNavbarProps {
  onTxCreated?: () => Promise<void>;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

function TransactionNavbar({
  onTxCreated,
  filters,
  onFiltersChange,
}: TransactionNavbarProps) {
  const [minAmountInput, setMinAmountInput] = useState(
    filters.minAmount?.toString() || ""
  );
  const [maxAmountInput, setMaxAmountInput] = useState(
    filters.maxAmount?.toString() || ""
  );
  const [searchInput, setSearchInput] = useState(filters.search || "");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const updateFilters = (updates: Partial<Filters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const isMobile = useIsMobile();
  const { userId } = useUserInfo();
  const { data: transactions = [] } = useTransactions(userId);
  const categoryTransactionCounts = useTransactionCounts(transactions);

  const dateRange = {
    from: filters.fromISO ? new Date(filters.fromISO) : undefined,
    to: filters.toISO ? new Date(filters.toISO) : undefined,
  };

  const [tempDateRange, setTempDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>({
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

    setMinAmountInput("");
    setMaxAmountInput("");
  };

  const hasActiveFilters =
    filters.search ||
    filters.fromISO ||
    filters.toISO ||
    (filters.categoryIds?.length ?? 0) > 0 ||
    (filters.categoryNames?.length ?? 0) > 0 ||
    (filters.types?.length ?? 0) > 0 ||
    filters.minAmount !== undefined ||
    filters.maxAmount !== undefined;

  const handleAmountBlur = (type: "min" | "max", value: string) => {
    const numericValue = value ? parseFloat(value) : undefined;
    if (type == "min") {
      updateFilters({ minAmount: numericValue });
    } else {
      updateFilters({ maxAmount: numericValue });
    }
  };

  const handleSearchBlur = (value: string) => {
    updateFilters({ search: value || undefined });
  };

  const renderFilters = () => (
    <>
      {/* Date Range Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">
              {dateRange.from
                ? dateRange.to
                  ? `${format(dateRange.from, "MMM dd")} - ${format(
                      dateRange.to,
                      "MMM dd"
                    )}`
                  : format(dateRange.from, "MMM dd, yyyy")
                : "Date Range"}
            </span>
            <span className="sm:hidden">Date</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 bg-background border-border shadow-lg"
          align="start"
        >
          <Calendar
            mode="range"
            selected={{ from: tempDateRange.from, to: tempDateRange.to }}
            onSelect={(range) => {
              setTempDateRange({
                from: range?.from,
                to: range?.to,
              });

              // Only update filters when we have a complete selection or user clicks same date twice
              if (range?.from && range?.to) {
                // Complete range selected
                updateFilters({
                  fromISO: range.from.toISOString(),
                  toISO: range.to.toISOString(),
                });
              } else if (
                range?.from &&
                tempDateRange.from &&
                range.from.getTime() === tempDateRange.from.getTime()
              ) {
                // User clicked the same date twice, treat as single date
                updateFilters({
                  fromISO: range.from.toISOString(),
                  toISO: range.from.toISOString(),
                });
              }
            }}
            numberOfMonths={1}
          />
          <div className="p-3 border-t flex gap-2">
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
                onClick={() => {
                  updateFilters({
                    fromISO: tempDateRange.from!.toISOString(),
                    toISO: tempDateRange.from!.toISOString(),
                  });
                }}
              >
                Select Single Date
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Category Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Categories</span>
            <span className="sm:hidden">Cat</span>
            {(filters.categoryNames?.length ?? 0) > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 w-5 rounded-full p-0 text-xs"
              >
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

      {/* Type Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Type</span>
            {(filters.types?.length ?? 0) > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 w-5 rounded-full p-0 text-xs"
              >
                {filters.types?.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Transaction Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateFilters({ types: [] })}>
            Clear Selection
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => {
              const type = "income";
              const currentTypes = filters.types || [];
              updateFilters({
                types: currentTypes.includes(type)
                  ? currentTypes.filter((t) => t !== type)
                  : [...currentTypes, type],
              });
            }}
          >
            <TrendingUp className="h-4 w-4 text-green-500" />
            Income {filters.types?.includes("income") && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => {
              const type = "expense";
              const currentTypes = filters.types || [];
              updateFilters({
                types: currentTypes.includes(type)
                  ? currentTypes.filter((t) => t !== type)
                  : [...currentTypes, type],
              });
            }}
          >
            <TrendingDown className="h-4 w-4 text-red-500" />
            Expense {filters.types?.includes("expense") && "✓"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Amount Range Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Amount</span>
            <span className="sm:hidden">$</span>
            {(filters.minAmount !== undefined ||
              filters.maxAmount !== undefined) && (
              <Badge variant="secondary" className="ml-1">
                •
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Amount Range</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Min</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={minAmountInput}
                  onChange={(e) => setMinAmountInput(e.target.value)}
                  onBlur={() => handleAmountBlur("min", minAmountInput)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAmountBlur("min", minAmountInput);
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max</label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={maxAmountInput}
                  onChange={(e) => setMaxAmountInput(e.target.value)}
                  onBlur={() => handleAmountBlur("max", maxAmountInput)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAmountBlur("max", maxAmountInput);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Sort Options */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <SortAsc className="h-4 w-4" />
            <span className="hidden sm:inline">Sort</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateFilters({ sortBy: "date" })}>
            Date{" "}
            {filters.sortBy === "date" && `(${filters.sortOrder || "desc"})`}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateFilters({ sortBy: "amount" })}>
            Amount{" "}
            {filters.sortBy === "amount" && `(${filters.sortOrder || "desc"})`}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => updateFilters({ sortBy: "category" })}
          >
            Category{" "}
            {filters.sortBy === "category" &&
              `(${filters.sortOrder || "desc"})`}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              updateFilters({
                sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
              })
            }
          >
            {filters.sortOrder === "asc" ? "Descending" : "Ascending"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="gap-2 text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Clear</span>
        </Button>
      )}
    </>
  );

  return (
    <div className="bg-gradient-card border-b border-border/20 shadow-sm w-full px-4 sm:px-6 py-4 space-y-4">
      {/* Top Row - Title and Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">
          Transactions
        </h2>
        <Modal dialogId="add_modal" tx={null} onTxCreated={onTxCreated} />
      </div>

      {/* Mobile: Search and Filters Toggle */}
      {isMobile ? (
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search transactions by note or merchant"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={() => handleSearchBlur(searchInput)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchBlur(searchInput);
                }
              }}
              className="pl-10 bg-background/50 border-border/30 text-foreground placeholder:text-muted-foreground focus:ring-primary/20"
            />
          </div>

          {/* Filters Sheet */}
          <div className="flex items-center gap-2">
            <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Menu className="h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 w-5 rounded-full p-0 text-xs"
                    >
                      •
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                  <SheetTitle>Filter Transactions</SheetTitle>
                  <SheetDescription>
                    Use filters to narrow down your transaction list
                  </SheetDescription>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {renderFilters()}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      ) : (
        /* Desktop: Search and Filters Row */
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 min-w-64 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search transactions by note or merchant"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={() => handleSearchBlur(searchInput)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchBlur(searchInput);
                }
              }}
              className="pl-10 bg-background/50 border-border/30 text-foreground placeholder:text-muted-foreground focus:ring-primary/20"
            />
          </div>

          {renderFilters()}
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Active filters:
          </span>
          <span className="text-sm text-muted-foreground sm:hidden">
            Filters:
          </span>
          {filters.categoryNames?.map((category) => (
            <Badge key={category} variant="secondary" className="gap-1 text-xs">
              <span className="hidden sm:inline">{category}</span>
              <span className="sm:hidden">{category.slice(0, 3)}</span>
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  updateFilters({
                    categoryNames: filters.categoryNames?.filter(
                      (c) => c !== category
                    ),
                  })
                }
              />
            </Badge>
          ))}
          {filters.types?.map((type) => (
            <Badge key={type} variant="secondary" className="gap-1 text-xs">
              {type}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  updateFilters({
                    types: filters.types?.filter((t) => t !== type),
                  })
                }
              />
            </Badge>
          ))}
          {filters.fromISO && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {filters.toISO
                ? `${format(new Date(filters.fromISO), "MMM dd")} - ${format(
                    new Date(filters.toISO),
                    "MMM dd"
                  )}`
                : format(new Date(filters.fromISO), "MMM dd, yyyy")}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  updateFilters({ fromISO: undefined, toISO: undefined })
                }
              />
            </Badge>
          )}
          {(filters.minAmount !== undefined ||
            filters.maxAmount !== undefined) && (
            <Badge variant="secondary" className="gap-1 text-xs">
              ${filters.minAmount ?? "0"} - ${filters.maxAmount ?? "∞"}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => {
                  updateFilters({ minAmount: undefined, maxAmount: undefined });
                  setMinAmountInput("");
                  setMaxAmountInput("");
                }}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export { TransactionNavbar };
