import { AddBudget, AddField } from "./FieldSet";
import { useRef } from "react";
import type { TransactionWithCat } from "../lib/transactions";
import type { Budget } from "../lib/budgets";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";


type OnTxCreated = () => void | Promise<void>;

type ModalProps = {
  onTxCreated?: OnTxCreated;
  tx: TransactionWithCat | null; // null → add, object → edit
  dialogId: string;
  onClose?: () => void;
  showTrigger?: boolean;
};

export default function Modal({
  onTxCreated,
  tx,
  dialogId,
  onClose,
  showTrigger = true,
}: ModalProps) {
  const dlgRef = useRef<HTMLDialogElement>(null);

  return (
    <div>
      {showTrigger && (
        <Button
          onClick={() => dlgRef.current?.showModal()}
          className="bg-gradient-primary hover:shadow-glow transition-all duration-300 hover:scale-105"
        >
          <Plus className="h-4 w-4 mr-2"/>
          Add Transaction
        </Button>
      )}

      <dialog
        ref={dlgRef}
        id={dialogId}
        className="backdrop:bg-black/60 backdrop:backdrop-blur-sm p-0 bg-transparent border-0 rounded-xl max-w-md w-full"
      >
        <div className="bg-gradient-card border border-border/20 shadow-card rounded-xl p-6 backdrop-blur-md">
          <AddField
            existingTx={tx}
            onCreated={onTxCreated}
            onClose={() => {
              dlgRef.current?.close();
              onClose?.();
            }}
          />
        </div>
      </dialog>
    </div>
  );
}

type BudgetModalProps = {
  onTxCreated?: OnTxCreated;
  tx: Budget | null;
  dialogId: string;
  onClose?: () => void;
  showTrigger?: boolean;
};

export function BudgetModal({
  onTxCreated,
  tx,
  dialogId,
  onClose,
  showTrigger = true,
}: BudgetModalProps) {
  const dlgRef = useRef<HTMLDialogElement>(null);

  return (
    <div>
      {showTrigger && (
        <Button
          onClick={() => dlgRef.current?.showModal()}
          variant="hero"
          className="shadow-glow"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Budget
        </Button>
      )}

      <dialog
        ref={dlgRef}
        id={dialogId}
        className="backdrop:bg-black/60 backdrop:backdrop-blur-sm p-0 bg-transparent border-0 rounded-xl max-w-md w-full z-50"
      >
        <div className="bg-gradient-card border border-border/20 shadow-card rounded-xl p-6">
          <AddBudget
            existingTx={tx}
            onCreated={onTxCreated}
            onClose={() => {
              dlgRef.current?.close();
              onClose?.();
            }}
          />
        </div>
      </dialog>
    </div>
  );
}
