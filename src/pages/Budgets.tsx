import { BudgetModal } from "../components/Modal.tsx";
import { BudgetCard } from "../components/Card.tsx";
import { useEffect, useState } from "react";
import { useBudgets, useDeleteBudget } from "../features/budgets/useBudgets.ts";
import { type Budget } from "../lib/budgets.ts";
import { useUserInfo } from "../shared/useUserId.ts";

export default function Budgets() {
  const { userId } = useUserInfo();
  const [editing, setEditing] = useState<Budget | null>(null);

  const budgets = useBudgets(userId);
  const delBudget = useDeleteBudget(userId);

  /* -------- edit -------- */
  const handleEdit = (b: Budget) => setEditing(b);

  useEffect(() => {
    if (editing) {
      (
        document.getElementById("edit_budget_modal") as HTMLDialogElement | null
      )?.showModal();
    }
  }, [editing]);

  /* -------- delete -------- */
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this budget?")) return;
    delBudget.mutate(id);
  };

  /* -------- refresh -------- */
  const refetchBudgets = async () => {
    await budgets.refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 lg:p-8 gap-4">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Budgets
        </h1>
        <BudgetModal
          dialogId="add_modal"
          tx={null}
          onTxCreated={refetchBudgets}
        ></BudgetModal>
      </div>

      <BudgetModal
        dialogId="edit_budget_modal"
        tx={editing}
        showTrigger={false}
        onTxCreated={refetchBudgets}
        onClose={() => setEditing(null)}
      />

      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4 sm:mx-6 lg:mx-8 mb-8" />

      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        {budgets.isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-pulse text-muted-foreground">Loading Budgets...</div>
          </div>  
        ) : budgets.isError ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-destructive text-center">
              {budgets.error?.message ?? "Failed to load budgets"}
            </div>
          </div>
        ) : (budgets.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
            <div className="text-muted-foreground text-lg">
              No bugets yet
            </div>
            <p className="text-muted-foreground/60">
              Click the "Add Budget" button to create your first budget
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {budgets.data!.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}