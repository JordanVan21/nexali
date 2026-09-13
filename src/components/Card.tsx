import { PieChart, Pie, Cell, Tooltip } from "recharts";
import type { Budget } from "../lib/budgets.ts";
import { useSpentAmount } from "../features/budgets/useSpentAmount.ts";
import { useMemo } from "react";
import { useUserInfo } from "../shared/useUserId.ts";
import { Button } from "./ui/button.tsx";
import { Edit2, Trash2 } from "lucide-react";

interface BudgetCardProps {
  budget: Budget;
  onEdit?: (b: Budget) => void;
  onDelete?: (id: number) => void;
}

function BudgetCard({ budget, onEdit, onDelete }: BudgetCardProps) {
  const { amount: cap, categories } = budget;
  const catId = categories?.id;
  const catName = categories?.name ?? "Unknown";

  const { userId } = useUserInfo();

  const spentQ = useSpentAmount(userId, catId);
  const spent = spentQ.data ?? 0;

  const pct = cap > 0 ? (spent / cap) * 100 : 0;

  const data = useMemo(
    () => [
      { name: "Spent", value: Math.min((spent / cap) * 100, 100) },
      { name: "Remaining", value: Math.max((cap - spent) / cap * 100, 0) },
    ],
    [cap, spent]
  );

  const getColor = (p: number) => {
    if (p < 75) {
      return "hsl(142 76% 36%)";
    } else if (p < 95) {
      return "hsl(48 96% 53%)";
    } else {
      return "hsl(0 80% 60%)";
    }
  }
  const COLORS = [getColor(pct), "oklch(var(--muted))"];

  if (!categories || !userId) return null;

  return (
    <div className="bg-gradient-card border border-border/20 shadow-card rounded-xl backdrop-blur-md p-6 w-full max-w-sm mx-auto transition-all duration-300 hover:shadow-glow hover:scale-[1.02]">
      <header className="text-xl font-bold mb-6 text-center text-foreground">
        {catName.toUpperCase()}
      </header>
      <div className="flex justify-center mb-6">
        <div className="overflow-hidden" style={{ width: 200, height: 100 }}>
          <PieChart width={200} height={100}>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={50}
              outerRadius={70}
              dataKey="value"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) =>
                name === "Spent"
                  ? [`${value.toFixed(1)}% used`, ""]
                  : [`${value.toFixed(1)}% left`, ""]
              }
              contentStyle={{
                fontSize: "0.875rem",
                // backgroundColor: "oklch(var(--popover))",
                border: "1px solid oklch(var(--border) / 45%)",
                borderRadius: "8px",
                color: "oklch(var(--popover-foreground))"
              }}
            />
          </PieChart>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground text-white">Budgeted:</span>
          <span className="font-medium text-foreground">${cap.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground text-white">Spent:</span>
          <span className="font-medium text-foreground">
            {spentQ.isLoading ? "..." : `$${spent.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground text-white">Remaining:</span>
          <span className={`font-medium ${(cap-spent) >= 0 ? 'text-success' : 'text-destructive'}`}>
            {spentQ.isLoading ? "..." : `$${(cap-spent).toFixed(2)}`}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onEdit?.(budget)}
        >
          <Edit2 className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => onDelete?.(budget.id)}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}

export { BudgetCard };
