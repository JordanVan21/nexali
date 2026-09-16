import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../ui/button";
import { useFormatCurrency, useFormatPreferences } from "../../features/profiles/useFormatPreferences";
import {
  YOU_PARTICIPANT_ID,
  centsToDollars,
  formatReceiptDate,
  itemShareCents,
  overallParticipantTotals,
  receiptParticipantTotals,
  type Participant,
  type SplitReceipt,
} from "../../lib/splitExpenses";

type PerPersonLine = { label: string; amountCents: number };

/** Every line item (across every receipt) that contributes to one participant's total -- backs the expandable per-person breakdown. */
function perPersonLines(receipts: SplitReceipt[], participantId: string): PerPersonLine[] {
  const lines: PerPersonLine[] = [];
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      const shares = itemShareCents(item);
      const cents = shares.get(participantId);
      if (cents) {
        const suffix = item.assignment.kind === "shared" ? " (shared)" : "";
        lines.push({ label: `${item.name}${suffix}`, amountCents: cents });
      }
    }
  }
  return lines;
}

export function SplitPreview({
  receipts,
  participants,
  onEdit,
}: {
  receipts: SplitReceipt[];
  participants: Participant[];
  onEdit: () => void;
}) {
  const formatCurrency = useFormatCurrency();
  const { dateFormat } = useFormatPreferences();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const overallTotals = overallParticipantTotals(receipts);
  const grandTotalCents = Array.from(overallTotals.values()).reduce((sum, c) => sum + c, 0);
  const rows = participants.filter((p) => overallTotals.has(p.id));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* "Who owes what" -- the most important answer, shown first and largest. */}
      <section aria-labelledby="split-preview-who-owes" className="nexali-panel rounded-xl p-5 md:p-6">
        <h2 id="split-preview-who-owes" className="font-display text-lg font-semibold text-foreground">
          Who owes what
        </h2>
        <dl className="mt-4 space-y-3">
          {rows.map((p) => {
            const isExpanded = expanded.has(p.id);
            const lines = perPersonLines(receipts, p.id);
            return (
              <div key={p.id} className="rounded-lg border border-outline-variant/40 bg-surface-lowest">
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="font-medium text-foreground">
                    {p.id === YOU_PARTICIPANT_ID ? "You" : p.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="numeric text-lg font-semibold text-foreground">
                      {formatCurrency(centsToDollars(overallTotals.get(p.id)!))}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </span>
                </button>
                {isExpanded && (
                  <div className="space-y-1.5 border-t border-outline-variant/40 px-4 py-3 text-sm">
                    {lines.map((line, i) => (
                      <div key={i} className="flex items-center justify-between text-muted-foreground">
                        <span>{line.label}</span>
                        <span className="numeric">{formatCurrency(centsToDollars(line.amountCents))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t border-outline-variant/40 pt-3 font-semibold text-foreground">
            <dt>Grand Total</dt>
            <dd className="numeric text-lg">{formatCurrency(centsToDollars(grandTotalCents))}</dd>
          </div>
        </dl>
      </section>

      {/* Receipts included, with category/total, and the per-receipt transaction preview. */}
      <section aria-labelledby="split-preview-receipts" className="space-y-3">
        <h2 id="split-preview-receipts" className="font-display text-lg font-semibold text-foreground">
          Receipts in this split
        </h2>
        {receipts.map((receipt) => {
          const yourShare = receiptParticipantTotals(receipt).get(YOU_PARTICIPANT_ID) ?? 0;
          return (
            <div key={receipt.id} className="nexali-panel rounded-xl p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{receipt.merchant ?? receipt.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {receipt.categoryName ?? "Uncategorized"}
                    {receipt.purchaseDate && ` · ${formatReceiptDate(receipt.purchaseDate, dateFormat)}`}
                  </p>
                </div>
                <p className="numeric font-semibold text-foreground">
                  {receipt.parsedTotalCents != null ? formatCurrency(centsToDollars(receipt.parsedTotalCents)) : "—"}
                </p>
              </div>

              <div className="mt-3 rounded-lg border border-outline-variant/40 bg-surface-lowest p-3 text-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transaction Preview</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <dt className="text-muted-foreground">Merchant</dt>
                  <dd className="text-right text-foreground">{receipt.merchant ?? "Unknown"}</dd>
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="text-right text-foreground">{receipt.categoryName ?? "Uncategorized"}</dd>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="text-right text-foreground">
                    {receipt.purchaseDate ? formatReceiptDate(receipt.purchaseDate, dateFormat) : "Unknown"}
                  </dd>
                  <dt className="text-muted-foreground">Your Amount</dt>
                  <dd className="numeric text-right font-semibold text-foreground">{formatCurrency(centsToDollars(yourShare))}</dd>
                </dl>
                <p className="mt-2 text-xs italic text-muted-foreground">Ready to create after submission</p>
              </div>
            </div>
          );
        })}
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="surface" size="control" onClick={onEdit}>
          Edit
        </Button>
        <div className="flex flex-col items-end gap-1.5">
          <Button type="button" variant="hero" size="control" disabled title="Submission will be enabled after backend integration.">
            Submit
          </Button>
          <p className="text-xs italic text-muted-foreground">Backend integration pending — nothing is saved yet.</p>
        </div>
      </div>
    </div>
  );
}
