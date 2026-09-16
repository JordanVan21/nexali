import { useFormatCurrency } from "../../features/profiles/useFormatPreferences";
import { centsToDollars, overallParticipantTotals, type Participant, type SplitReceipt } from "../../lib/splitExpenses";

/**
 * Live running totals across every receipt currently in the split --
 * updates immediately as assignments change (pure client-side math, see
 * lib/splitExpenses.ts). Participants with nothing assigned to them yet
 * are omitted rather than shown as a confusing $0.00 row.
 */
export function SplitSummaryCard({ receipts, participants }: { receipts: SplitReceipt[]; participants: Participant[] }) {
  const formatCurrency = useFormatCurrency();
  const totals = overallParticipantTotals(receipts);
  const grandTotalCents = Array.from(totals.values()).reduce((sum, c) => sum + c, 0);
  const rows = participants.filter((p) => totals.has(p.id));

  return (
    <section aria-labelledby="split-summary-heading" className="nexali-panel rounded-xl p-4 md:p-5">
      <h2 id="split-summary-heading" className="text-sm font-semibold text-foreground">
        Split Summary
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing assigned yet — totals will appear as you assign items.</p>
      ) : (
        <dl className="mt-3 space-y-2">
          {rows.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <dt className="text-foreground">{p.name}</dt>
              <dd className="numeric font-medium text-foreground">{formatCurrency(centsToDollars(totals.get(p.id)!))}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-outline-variant/40 pt-2 text-sm font-semibold text-foreground">
            <dt>Grand Total</dt>
            <dd className="numeric">{formatCurrency(centsToDollars(grandTotalCents))}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
