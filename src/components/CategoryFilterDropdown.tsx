import React from "react";
import { Check } from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "../components/ui/dropdownMenu";
import { useListCategories } from "../features/categories/useCategories";

interface CategoryFilterDropdownProps {
  userId: string;
  selectedCategories: string[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
  categoryTransactionCounts?: Record<string, number>;
}

export function CategoryFilterDropdown({
  userId,
  selectedCategories,
  setSelectedCategories,
  categoryTransactionCounts = {},
}: CategoryFilterDropdownProps) {
  const { data: categories = [], isLoading } = useListCategories(
    userId
  );

  const handleToggleCategory = (categoryName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  return (
    <DropdownMenuContent
      align="start"
      className="w-48 max-h-80"
    >
      <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <DropdownMenuItem onClick={() => setSelectedCategories([])}>
        Clear Selection
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <div className="max-h-60 overflow-y-auto">
        {isLoading ? (
            <DropdownMenuItem disabled>
            Loading Categories...
            </DropdownMenuItem>
        ) : categories.length > 0 ? (
          categories.map((category) => {
            const selected = selectedCategories.includes(category.name);
            return (
              <DropdownMenuItem
                key={category.id}
                onClick={() => handleToggleCategory(category.name)}
                aria-pressed={selected}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <Check
                    className={selected ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5 opacity-0"}
                    aria-hidden="true"
                  />
                  {category.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({categoryTransactionCounts[category.name] || 0})
                </span>
              </DropdownMenuItem>
            );
          })
        ) : (
          <DropdownMenuItem disabled>No categories found</DropdownMenuItem>
        )}
      </div>
    </DropdownMenuContent>
  );
}