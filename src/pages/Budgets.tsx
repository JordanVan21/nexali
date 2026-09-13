import { useState } from "react";
import { PlusCircle, Wallet } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/states/EmptyState";
import { ErrorState } from "../components/states/ErrorState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { BudgetCard } from "../components/budgets/BudgetCard";
import { BudgetSummaryBar } from "../components/budgets/BudgetSummaryBar";
import { BudgetFormDialog } from "../components/budgets/BudgetFormDialog";
import { BudgetPeriodNav } from "../components/budgets/BudgetPeriodNav";
import { BudgetsSkeleton } from "../components/budgets/BudgetsSkeleton";
import { useDeleteBudget } from "../features/budgets/useBudgets";
import { useBudgetsForPeriod } from "../features/budgets/useBudgetsForPeriod";
import { useUserInfo } from "../shared/useUserId";
import { getErrorMessage } from "../lib/utils";
import type { Budget } from "../lib/budgets";
import type { BudgetProgressDetail } from "../lib/budgetMath";

function now() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export default function Budgets() {
  const { userId } = useUserInfo();
  const [{ month, year }, setPeriod] = useState(now());
  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BudgetProgressDetail | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const data = useBudgetsForPeriod(userId, year, month);
  const deleteBudget = useDeleteBudget(userId);

  const openAdd = () => {
    setEditingBudget(null);
    setFormOpen(true);
  };

  const openEdit = (progress: BudgetProgressDetail) => {
    setEditingBudget({
      id: progress.id,
      amount: progress.amount,
      month: progress.month,
      year: progress.year,
      category_id: progress.categoryId,
      categories: progress.categoryId != null ? { id: progress.categoryId, name: progress.category, type: "expense" } : null,
    });
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError(null);
    try {
      await deleteBudget.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Failed to delete budget"));
    }
  };

  const isLoading = data.budgetsList.isLoading || data.spendData.isLoading;

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[36px] lg:text-[44px] xl:text-[48px]">Budget Planner</h1>
          <p className="mt-1 text-[15px] text-muted-foreground sm:text-base lg:text-lg xl:text-xl">Manage your monthly allocations by category.</p>
        </div>
        <Button variant="hero" size="control" className="max-md:w-full" onClick={openAdd}>
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          Add Budget
        </Button>
      </div>

      <div className="mt-6">
        <BudgetPeriodNav month={month} year={year} onChange={(m, y) => setPeriod({ month: m, year: y })} />
      </div>

      <div className="mt-6 md:mt-8">
        {isLoading ? (
          <BudgetsSkeleton />
        ) : data.budgetsList.isError ? (
          <ErrorState
            title="Couldn't load your budgets"
            message="We couldn't load your budgets right now. Please try again."
            onRetry={data.budgetsList.refetch}
          />
        ) : data.spendData.isError ? (
          <ErrorState
            title="Couldn't load your spending"
            message="Budget progress depends on your transaction history, which we couldn't load right now. Please try again."
            onRetry={data.spendData.refetch}
          />
        ) : data.budgets.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={data.budgetsList.hasNeverCreatedAny ? "No budgets yet" : "No budgets for this month"}
            description={
              data.budgetsList.hasNeverCreatedAny
                ? "Create your first budget category to start tracking your monthly spending limits."
                : "Create a budget for this period, or use the arrows above to check another month."
            }
            action={
              <Button variant="hero" size="control" onClick={openAdd}>
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Add Budget
              </Button>
            }
          />
        ) : (
          <div className="space-y-6 md:space-y-8">
            <BudgetSummaryBar {...data.summary} />

            <section className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground lg:text-xl xl:text-2xl">Active Budgets</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.budgets.map((b) => (
                  <BudgetCard key={b.id} budget={b} onEdit={() => openEdit(b)} onDelete={() => setPendingDelete(b)} />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <BudgetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        userId={userId}
        editing={editingBudget}
        defaultMonth={month}
        defaultYear={year}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
        title="Delete this budget?"
        description={
          pendingDelete
            ? `The budget for "${pendingDelete.category}" will be permanently removed. This can't be undone.`
            : "This can't be undone."
        }
        onConfirm={confirmDelete}
        isPending={deleteBudget.isPending}
        errorMessage={deleteError}
      />
    </PageContainer>
  );
}
