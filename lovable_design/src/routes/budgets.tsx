import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PlusCircle, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { BudgetSummaryBar } from "@/components/budgets/BudgetSummaryBar";
import { BudgetFormDialog, type BudgetFormValues } from "@/components/budgets/BudgetFormDialog";
import { DeleteBudgetDialog } from "@/components/budgets/DeleteBudgetDialog";
import { BudgetsSkeleton } from "@/components/budgets/BudgetsSkeleton";
import { mockBudgets, type Budget } from "@/mock/budgets";
import { mockUser } from "@/mock/profile";

const title = "Budgets — Nexali";
const description = "Plan, track and adjust your monthly budget categories in Nexali.";

export const Route = createFileRoute("/budgets")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BudgetsPage,
});

function BudgetsPage() {
  // Local mock state only — swap for real Nexali hooks during integration.
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>(mockBudgets);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Budget | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
    return { totalBudget, totalSpent, available: totalBudget - totalSpent };
  }, [budgets]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (budget: Budget) => {
    setEditing(budget);
    setFormOpen(true);
  };

  const handleSubmit = (values: BudgetFormValues) => {
    const limit = Number(values.limit);
    const spent = values.spent ? Number(values.spent) : 0;

    if (editing) {
      setBudgets((list) =>
        list.map((b) =>
          b.id === editing.id
            ? {
                ...b,
                category: values.category.trim(),
                description: values.description.trim(),
                icon: values.icon,
                limit,
                spent,
              }
            : b,
        ),
      );
      toast.success("Budget updated");
    } else {
      setBudgets((list) => [
        {
          id: `local-${Date.now()}`,
          category: values.category.trim(),
          description: values.description.trim(),
          icon: values.icon,
          limit,
          spent,
        },
        ...list,
      ]);
      toast.success("Budget created");
    }
    setFormOpen(false);
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    setBudgets((list) => list.filter((b) => b.id !== pendingDelete.id));
    toast.success("Budget deleted");
    setPendingDelete(null);
  };

  return (
    <AppShell activeKey="budgets" userName={mockUser.name}>
      <PageContainer>
        <PageHeader
          title="Budget Planner"
          description="Manage your monthly allocations and optimize efficiency."
          actions={
            <Button variant="brand" size="control" onClick={openAdd} className="max-md:w-full">
              <PlusCircle className="h-4 w-4" />
              Create New Category
            </Button>
          }
        />

        {loading ? (
          <BudgetsSkeleton />
        ) : (
          <div className="space-y-6 md:space-y-8">
            <BudgetSummaryBar
              totalBudget={totals.totalBudget}
              totalSpent={totals.totalSpent}
              available={totals.available}
            />

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-foreground">Active Budgets</h2>
              </div>

              {budgets.length === 0 ? (
                <div className="nexali-panel rounded-xl">
                  <EmptyState
                    icon={Wallet}
                    title="No budgets yet"
                    description="Create your first budget category to start tracking your monthly spending limits."
                    action={
                      <Button variant="brand" size="control" onClick={openAdd}>
                        <PlusCircle className="h-4 w-4" />
                        Create New Category
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {budgets.map((b) => (
                    <BudgetCard key={b.id} budget={b} onEdit={openEdit} onDelete={setPendingDelete} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </PageContainer>

      <BudgetFormDialog open={formOpen} onOpenChange={setFormOpen} budget={editing} onSubmit={handleSubmit} />

      <DeleteBudgetDialog
        budget={pendingDelete}
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}
