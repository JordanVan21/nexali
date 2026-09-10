import * as React from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Check, Plus, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
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
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const {
    data: items = [],
    isLoading,
    isFetching,
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

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    try {
      const res = await create.mutateAsync({ name, type });
      const created = { id: res.id, name: normalizedQuery }; // Use normalized name
      onChange(created);
      setOpen(false);
      setQuery("");
    } catch (error) {
      console.error("Failed to create category:", error);
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
        type="button"
        variant="outline"
        className="w-full justify-between text-white"
        disabled={!enabled || busy}
        onClick={() => setOpen(!open)}
      >
        <span className={cn(value?.name ? "text-white" : "text-muted-foreground")}>
          {value?.name || placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute top-full left-0 w-full mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-60 overflow-hidden">
          <div className="p-2">
            <Input
              placeholder="Search or type to create..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-2 text-white"
              disabled={busy}
            />
          </div>
          
          <div className="max-h-40 overflow-y-auto">
            {busy ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                Loading...
              </div>
            ) : filtered.length > 0 ? (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm text-white"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value?.id === item.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{item.name}</span>
                </button>
              ))
            ) : query.trim() ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No categories found
              </div>
            ) : (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No categories available
              </div>
            )}
            
            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={create.isPending}
                className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm border-t border-border text-white"
              >
                <Plus className="h-4 w-4" />
                <span>
                  {create.isPending ? "Creating..." : `Create "${normalizedQuery}"`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}