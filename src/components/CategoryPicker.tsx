import * as React from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Check, Plus, ChevronDown } from "lucide-react";
import { cn, getErrorMessage } from "../lib/utils";
import { useListCategories, useCreateCategory } from "../features/categories/useCategories";

type CatItem = { id: number | string; name: string };

type Props = {
  userId: string;
  type: "income" | "expense";
  value: CatItem | null;
  onChange: (cat: CatItem) => void;
  placeholder?: string;
  enabled?: boolean;
};

// Same normalization function as backend
const toTitle = (s: string) =>
  s.trim().replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

export function CategoryPicker({
  userId,
  type,
  value,
  onChange,
  placeholder = "Select a category",
  enabled = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const {
    data: items = [],
    isLoading,
    isFetching,
    isError,
    error: listError,
  } = useListCategories(userId, type, { enabled: enabled && !!userId && !!type });

  const create = useCreateCategory(userId);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const normalizedQuery = toTitle(query);

  const showCreate =
    query.trim().length > 0 &&
    !filtered.some((i) => i.name === normalizedQuery); // Exact match after normalization

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setCreateError(null);
    try {
      const res = await create.mutateAsync({ name, type });
      const created = { id: res.id, name: normalizedQuery }; // Use normalized name
      onChange(created);
      setOpen(false);
      setQuery("");
    } catch (error) {
      setCreateError(getErrorMessage(error, "Failed to create category."));
    }
  }

  function handleSelect(item: CatItem) {
    onChange(item);
    setOpen(false);
    setQuery("");
  }

  const busy = isLoading || isFetching || create.isPending;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className="h-11 w-full justify-between text-foreground"
        disabled={!enabled || busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Category: ${value?.name || placeholder}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn(value?.name ? "text-foreground" : "text-muted-foreground")}>
          {value?.name || placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <div className="p-2">
            <Input
              autoFocus
              aria-label="Search or create a category"
              placeholder="Search or type to create…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-2 text-foreground"
              disabled={busy}
            />
          </div>

          {isError && (
            <div className="px-3 pb-2 text-sm text-destructive">
              {getErrorMessage(listError, "Failed to load categories.")}
            </div>
          )}
          {createError && <div className="px-3 pb-2 text-sm text-destructive">{createError}</div>}

          <div role="listbox" className="max-h-40 overflow-y-auto">
            {busy ? (
              <div className="p-2 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length > 0 ? (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={value?.id === item.id}
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Check
                    className={cn("h-4 w-4", value?.id === item.id ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                  <span>{item.name}</span>
                </button>
              ))
            ) : query.trim() ? (
              <div className="p-2 text-center text-sm text-muted-foreground">No categories found</div>
            ) : (
              <div className="p-2 text-center text-sm text-muted-foreground">No categories available</div>
            )}

            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={create.isPending}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{create.isPending ? "Creating…" : `Create "${normalizedQuery}"`}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
