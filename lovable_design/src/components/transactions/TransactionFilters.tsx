import { ArrowDownUp, CalendarDays, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TransactionCategory, TransactionType } from "@/mock/transactions";

export type TransactionFilterState = {
  search: string;
  categoryId: string;
  /** direction: all | income | expense */
  type: string;
  /** payment method: all | Debit | Credit | Transfer | Automatic */
  method: string;
  /** amount bucket key */
  amount: string;
  sort: string;
};

export const amountOptions = [
  { value: "all", label: "Amount: Any" },
  { value: "0-50", label: "Under $50" },
  { value: "50-200", label: "$50 – $200" },
  { value: "200-1000", label: "$200 – $1,000" },
  { value: "1000+", label: "Over $1,000" },
];

export const sortOptions = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Largest amount" },
  { value: "amount-asc", label: "Smallest amount" },
  { value: "merchant-asc", label: "Merchant A–Z" },
];

export type TransactionFiltersProps = {
  value: TransactionFilterState;
  onChange: (value: TransactionFilterState) => void;
  onReset: () => void;
  categories: TransactionCategory[];
  types: TransactionType[];
  dateRangeLabel: string;
  activeFilterCount: number;
  mobileFiltersOpen: boolean;
  onMobileFiltersOpenChange: (open: boolean) => void;
};

export function TransactionFilters({
  value,
  onChange,
  onReset,
  categories,
  types,
  dateRangeLabel,
  activeFilterCount,
  mobileFiltersOpen,
  onMobileFiltersOpenChange,
}: TransactionFiltersProps) {
  const set = (patch: Partial<TransactionFilterState>) => onChange({ ...value, ...patch });

  const triggerClass = "h-11 rounded-lg border-outline-variant bg-surface-lowest text-sm";

  const categorySelect = (
    <Select value={value.categoryId} onValueChange={(v) => set({ categoryId: v })}>
      <SelectTrigger aria-label="Filter by category" className={triggerClass}>
        <SelectValue placeholder="Category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Category: All</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const typeSelect = (
    <Select value={value.type} onValueChange={(v) => set({ type: v })}>
      <SelectTrigger aria-label="Filter by transaction type" className={triggerClass}>
        <SelectValue placeholder="Type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Type: All</SelectItem>
        <SelectItem value="income">Income</SelectItem>
        <SelectItem value="expense">Expense</SelectItem>
      </SelectContent>
    </Select>
  );

  const methodSelect = (
    <Select value={value.method} onValueChange={(v) => set({ method: v })}>
      <SelectTrigger aria-label="Filter by payment method" className={triggerClass}>
        <SelectValue placeholder="Method" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Method: All</SelectItem>
        {types.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const amountSelect = (
    <Select value={value.amount} onValueChange={(v) => set({ amount: v })}>
      <SelectTrigger aria-label="Filter by amount" className={triggerClass}>
        <SelectValue placeholder="Amount" />
      </SelectTrigger>
      <SelectContent>
        {amountOptions.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const sortSelect = (
    <Select value={value.sort} onValueChange={(v) => set({ sort: v })}>
      <SelectTrigger aria-label="Sort transactions" className={triggerClass}>
        <ArrowDownUp className="h-4 w-4 text-outline" aria-hidden="true" />
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <>
      {/* Mobile: search + filter button */}
      <div className="mb-4 flex items-center gap-2 md:hidden">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline"
          />
          <Input
            type="search"
            aria-label="Search transactions"
            placeholder="Search merchant or note..."
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
            className="h-11 rounded-lg border-outline-variant bg-surface-lowest pl-9"
          />
        </div>
        <Button
          type="button"
          variant="surface"
          size="control"
          className="relative shrink-0"
          onClick={() => onMobileFiltersOpenChange(true)}
          aria-label="Open filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Tablet + desktop: filter shell */}
      <div className="nexali-panel mb-4 hidden flex-wrap items-center gap-2 rounded-xl p-3 md:flex md:mb-6 md:gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline"
          />
          <Input
            type="search"
            aria-label="Search merchant or note"
            placeholder="Search by merchant or note..."
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
            className="h-11 rounded-lg border-outline-variant bg-surface-lowest pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="surface" size="control" className="hidden xl:inline-flex">
            <CalendarDays className="h-4 w-4" />
            {dateRangeLabel}
          </Button>
          <div className="w-[150px]">{categorySelect}</div>
          <div className="w-[135px]">{typeSelect}</div>
          <div className="w-[145px]">{methodSelect}</div>
          <div className="w-[145px]">{amountSelect}</div>
          <div className="w-[165px]">{sortSelect}</div>
          <Button type="button" variant="link" className="px-2 text-sm" onClick={onReset}>
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Mobile filter sheet */}
      <Sheet open={mobileFiltersOpen} onOpenChange={onMobileFiltersOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border-outline-variant/50 bg-card px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant" aria-hidden="true" />
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-lg">Filters</SheetTitle>
            <SheetDescription>Narrow down your financial activity.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sheet-category">Category</Label>
              <div id="sheet-category">{categorySelect}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sheet-type">Type</Label>
              <div id="sheet-type">{typeSelect}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sheet-method">Method</Label>
              <div id="sheet-method">{methodSelect}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sheet-amount">Amount</Label>
              <div id="sheet-amount">{amountSelect}</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sheet-sort">Sort by</Label>
              <div id="sheet-sort">{sortSelect}</div>
            </div>
            <div className="grid gap-2">
              <Label>Date range</Label>
              <Button type="button" variant="surface" size="control" className="justify-start">
                <CalendarDays className="h-4 w-4" />
                {dateRangeLabel}
              </Button>
            </div>
          </div>
          <SheetFooter className="mt-6 flex-row gap-2">
            <Button type="button" variant="surface" size="control" className="flex-1" onClick={onReset}>
              Reset
            </Button>
            <Button
              type="button"
              variant="brand"
              size="control"
              className="flex-1"
              onClick={() => onMobileFiltersOpenChange(false)}
            >
              Show results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
