import { ChevronDown, ChevronUp, Image as ImageIcon, Loader2, Receipt as ReceiptIcon, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CategoryPicker } from "../CategoryPicker";
import { AssignmentControl } from "./AssignmentControl";
import { useFormatCurrency, useFormatPreferences } from "../../features/profiles/useFormatPreferences";
import { cn } from "../../lib/utils";
import {
  YOU_PARTICIPANT_ID,
  centsToDollars,
  formatReceiptDate,
  itemShareCents,
  receiptAssignedCents,
  receiptItemsSubtotalCents,
  receiptUnassignedCents,
  type Participant,
  type SplitReceipt,
  type SplitReceiptItem,
} from "../../lib/splitExpenses";

type CatItem = { id: number | string; name: string };

const STATUS_BADGE: Record<SplitReceipt["status"], { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", className: "bg-primary/15 text-primary" },
  parsed: { label: "Parsed", className: "bg-success/15 text-success" },
  error: { label: "Error", className: "bg-destructive/15 text-destructive" },
};

function shareSummary(item: SplitReceiptItem, formatCurrency: (n: number) => string): string {
  const shares = itemShareCents(item);
  if (shares.size === 0) return "—";
  if (shares.size === 1) {
    const [[, cents]] = shares;
    return formatCurrency(centsToDollars(cents));
  }
  const [[, cents]] = shares;
  return `${formatCurrency(centsToDollars(cents))} each`;
}

export function ReceiptCard({
  receipt,
  userId,
  participants,
  onRemove,
  onToggleCollapsed,
  onCategoryChange,
  onItemAssignmentChange,
  onSetAllMine,
  onPayerChange,
}: {
  receipt: SplitReceipt;
  userId: string;
  participants: Participant[];
  onRemove: () => void;
  onToggleCollapsed: () => void;
  onCategoryChange: (categoryId: number, categoryName: string) => void;
  onItemAssignmentChange: (itemId: string, assignment: SplitReceiptItem["assignment"]) => void;
  onSetAllMine: () => void;
  onPayerChange: (participantId: string) => void;
}) {
  const formatCurrency = useFormatCurrency();
  const { dateFormat } = useFormatPreferences();
  const statusBadge = STATUS_BADGE[receipt.status];

  const itemsSubtotal = receiptItemsSubtotalCents(receipt);
  const assigned = receiptAssignedCents(receipt);
  const unassigned = receiptUnassignedCents(receipt);

  return (
    <div className="nexali-panel overflow-hidden rounded-xl">
      <div className="flex items-start gap-3 p-4 md:p-5">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-high">
          {receipt.imageUrl ? (
            <img src={receipt.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold text-foreground">
              {receipt.merchant ?? receipt.fileName}
            </h3>
            <Badge className={cn("border-transparent", statusBadge.className)}>{statusBadge.label}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {receipt.purchaseDate && `${formatReceiptDate(receipt.purchaseDate, dateFormat)} · `}
            {receipt.items.length} item{receipt.items.length === 1 ? "" : "s"}
            {receipt.parsedTotalCents != null && ` · ${formatCurrency(centsToDollars(receipt.parsedTotalCents))}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {receipt.status === "parsed" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={receipt.collapsed ? `Expand ${receipt.merchant ?? receipt.fileName}` : `Collapse ${receipt.merchant ?? receipt.fileName}`}
              onClick={onToggleCollapsed}
            >
              {receipt.collapsed ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${receipt.merchant ?? receipt.fileName}`}
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {receipt.status === "processing" && (
        <div className="flex items-center gap-2 border-t border-outline-variant/40 px-4 py-4 text-sm text-muted-foreground md:px-5">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Reading this receipt…
        </div>
      )}

      {receipt.status === "error" && (
        <div className="flex items-start gap-2 border-t border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive md:px-5">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{receipt.errorMessage ?? "Couldn't read this receipt."} Remove it and try a different photo.</span>
        </div>
      )}

      {receipt.status === "parsed" && !receipt.collapsed && (
        <div className="border-t border-outline-variant/40 p-4 md:p-5">
          <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`split-category-${receipt.id}`}>Category</Label>
              <CategoryPicker
                userId={userId}
                type="expense"
                value={receipt.categoryId != null ? ({ id: receipt.categoryId, name: receipt.categoryName ?? "" } as CatItem) : null}
                onChange={(cat) => onCategoryChange(Number(cat.id), cat.name)}
                placeholder="Choose a category…"
                // Split Expenses can involve other Nexali accounts, so only
                // GLOBAL categories (safe for every participant's own
                // generated transaction) are offered here -- see
                // CategoryPicker's own globalOnly doc comment.
                globalOnly
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`split-payer-${receipt.id}`}>Who Paid?</Label>
              <Select value={receipt.payerParticipantId ?? undefined} onValueChange={onPayerChange}>
                <SelectTrigger
                  id={`split-payer-${receipt.id}`}
                  className={cn("h-11", receipt.payerParticipantId == null && "border-warning/50 bg-warning/10")}
                >
                  <SelectValue placeholder="Choose who paid…" />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.id === YOU_PARTICIPANT_ID ? "You" : p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {receipt.payerParticipantId == null && (
                <p className="text-xs text-warning-foreground">Choose who paid before this receipt can be processed.</p>
              )}
            </div>
          </div>

          {receipt.items.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              <ReceiptIcon className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
              No items were detected on this receipt.
            </p>
          ) : (
            <>
              {/* Desktop: one row per item in a table. */}
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Price</th>
                      <th className="px-3 py-2 font-medium">Assignment</th>
                      <th className="py-2 pl-3 text-right font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.items.map((item) => (
                      <tr key={item.id} className="border-b border-outline-variant/20 last:border-0">
                        <td className="py-2.5 pr-3 text-foreground">{item.name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{item.quantity}</td>
                        <td className="px-3 py-2.5 numeric text-foreground">{formatCurrency(centsToDollars(item.totalCents))}</td>
                        <td className="px-3 py-2.5">
                          <AssignmentControl
                            itemName={item.name}
                            assignment={item.assignment}
                            participants={participants}
                            onChange={(a) => onItemAssignmentChange(item.id, a)}
                          />
                        </td>
                        <td className="py-2.5 pl-3 text-right numeric text-foreground">{shareSummary(item, formatCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile/tablet-portrait: compact stacked cards, never the wide desktop table. */}
              <ul className="mt-4 space-y-2 md:hidden">
                {receipt.items.map((item) => (
                  <li key={item.id} className="rounded-lg border border-outline-variant/40 bg-surface-lowest p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="numeric text-foreground">{formatCurrency(centsToDollars(item.totalCents))}</p>
                        <p className="text-xs text-muted-foreground">{shareSummary(item, formatCurrency)}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <AssignmentControl
                        itemName={item.name}
                        assignment={item.assignment}
                        participants={participants}
                        onChange={(a) => onItemAssignmentChange(item.id, a)}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <Button type="button" variant="surface" size="sm" onClick={onSetAllMine}>
                  Set all to Mine
                </Button>
              </div>
            </>
          )}

          {receipt.extraRows.length > 0 && (
            <div className="mt-4 space-y-1 border-t border-outline-variant/40 pt-3 text-sm text-muted-foreground">
              {receipt.extraRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between">
                  <span>{row.label}</span>
                  <span className="numeric">{formatCurrency(centsToDollars(row.amountCents))}</span>
                </div>
              ))}
              <p className="text-xs italic">Not yet included in the split — coming in a future update.</p>
            </div>
          )}

          <div className="mt-4 space-y-1 border-t border-outline-variant/40 pt-3 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Items subtotal</span>
              <span className="numeric">{formatCurrency(centsToDollars(itemsSubtotal))}</span>
            </div>
            {unassigned > 0 && (
              <div className="flex items-center justify-between text-warning">
                <span>Unassigned</span>
                <span className="numeric">{formatCurrency(centsToDollars(unassigned))}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Assigned</span>
              <span className="numeric">{formatCurrency(centsToDollars(assigned))}</span>
            </div>
            {receipt.parsedTotalCents != null && (
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span>Receipt Total</span>
                <span className="numeric">{formatCurrency(centsToDollars(receipt.parsedTotalCents))}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
