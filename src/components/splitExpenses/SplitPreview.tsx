import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../ui/button";
import { StatusBanner } from "../states/StatusBanner";
import { useFormatCurrency, useFormatPreferences } from "../../features/profiles/useFormatPreferences";
import { useSubmitSplitExpense } from "../../features/splitExpenses/useSubmitSplitExpense";
import { getErrorMessage } from "../../lib/utils";
import {
  YOU_PARTICIPANT_ID,
  buildSubmitSplitExpensePayload,
  centsToDollars,
  computeNetBalances,
  computeSettlements,
  describeSettlement,
  formatReceiptDate,
  isSubmittableToBackend,
  itemShareCents,
  overallParticipantTotals,
  receiptParticipantTotals,
  type Participant,
  type SplitReceipt,
  type SubmitSplitExpenseResult,
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

function participantDisplayName(p: Participant): string {
  return p.id === YOU_PARTICIPANT_ID ? "You" : p.name;
}

/** Plain-language net status -- "Receives $45.00" / "Owes $45.00" / "Settled", never bare accounting jargon. */
function netStatus(netCents: number, formatCurrency: (dollars: number) => string): { label: string; amount: string | null; className: string } {
  if (netCents > 0) return { label: "Receives", amount: formatCurrency(centsToDollars(netCents)), className: "text-success" };
  if (netCents < 0) return { label: "Owes", amount: formatCurrency(centsToDollars(-netCents)), className: "text-warning-foreground" };
  return { label: "Settled", amount: null, className: "text-muted-foreground" };
}

export function SplitPreview({
  receipts,
  participants,
  onEdit,
  onStartNewSplit,
  userId,
  idempotencyKey,
}: {
  receipts: SplitReceipt[];
  participants: Participant[];
  onEdit: () => void;
  /** Called after the user is done viewing a successful submission's confirmation -- clears local state for a fresh split. */
  onStartNewSplit: () => void;
  userId: string;
  /** Generated once per submission attempt by useSplitExpensesState.ts, reused across retries of the SAME attempt. */
  idempotencyKey: string | null;
}) {
  const formatCurrency = useFormatCurrency();
  const { dateFormat, currency } = useFormatPreferences();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [submitResult, setSubmitResult] = useState<SubmitSplitExpenseResult | null>(null);
  const submitMutation = useSubmitSplitExpense(userId);

  const canSubmitToBackend = isSubmittableToBackend(participants);

  async function handleSubmit() {
    if (!idempotencyKey || submitMutation.isPending) return;
    try {
      const payload = buildSubmitSplitExpensePayload({ idempotencyKey, currency, creatorUserId: userId, participants, receipts });
      const result = await submitMutation.mutateAsync(payload);
      setSubmitResult(result);
    } catch {
      // Surfaced via submitMutation.isError below -- every existing
      // receipt/participant/assignment stays exactly as entered (nothing
      // here clears local state), and retrying reuses the SAME
      // idempotencyKey, so a retry after a failed/uncertain network
      // request can never create a duplicate split.
    }
  }

  const overallTotals = overallParticipantTotals(receipts);
  const grandTotalCents = Array.from(overallTotals.values()).reduce((sum, c) => sum + c, 0);
  const rows = participants.filter((p) => overallTotals.has(p.id));

  // ALLOCATION (who is responsible for each item) vs PAYMENT (who actually
  // paid at checkout) are kept strictly separate -- see
  // lib/splitExpenses.ts's "Payment settlement" section doc comment.
  // Balances are computed across ALL participants (not just `rows`, which
  // only includes people with an allocated share) since someone could be a
  // receipt's payer while having nothing personally assigned to them.
  const balances = computeNetBalances(receipts, participants);
  const balanceByParticipant = new Map(balances.map((b) => [b.participantId, b]));
  const settlements = computeSettlements(balances);

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
      {/* ALLOCATION: what each person is responsible for, and (now that payer
          data exists) whether they end up receiving or owing money overall
          once what they paid is taken into account. */}
      <section aria-labelledby="split-preview-who-owes" className="nexali-panel rounded-xl p-5 md:p-6">
        <h2 id="split-preview-who-owes" className="font-display text-lg font-semibold text-foreground">
          Who owes what
        </h2>
        <dl className="mt-4 space-y-3">
          {rows.map((p) => {
            const isExpanded = expanded.has(p.id);
            const lines = perPersonLines(receipts, p.id);
            const balance = balanceByParticipant.get(p.id);
            const status = netStatus(balance?.netCents ?? 0, formatCurrency);
            return (
              <div key={p.id} className="rounded-lg border border-outline-variant/40 bg-surface-lowest">
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="font-medium text-foreground">{participantDisplayName(p)}</span>
                  <span className="flex items-center gap-2">
                    <span className={`numeric text-lg font-semibold ${status.className}`}>
                      {status.amount ? `${status.label} ${status.amount}` : status.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </span>
                </button>
                {isExpanded && (
                  <div className="space-y-3 border-t border-outline-variant/40 px-4 py-3 text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Allocated share</span>
                        <span className="numeric">{formatCurrency(centsToDollars(balance?.allocatedShareCents ?? 0))}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Paid</span>
                        <span className="numeric">{formatCurrency(centsToDollars(balance?.amountPaidCents ?? 0))}</span>
                      </div>
                      <div className={`flex items-center justify-between font-medium ${status.className}`}>
                        <span>Net</span>
                        <span className="numeric">
                          {balance && balance.netCents !== 0
                            ? `${balance.netCents > 0 ? "+" : "-"}${formatCurrency(centsToDollars(Math.abs(balance.netCents)))}`
                            : formatCurrency(0)}
                        </span>
                      </div>
                    </div>
                    {lines.length > 0 && (
                      <div className="space-y-1.5 border-t border-outline-variant/40 pt-2">
                        {lines.map((line, i) => (
                          <div key={i} className="flex items-center justify-between text-muted-foreground">
                            <span>{line.label}</span>
                            <span className="numeric">{formatCurrency(centsToDollars(line.amountCents))}</span>
                          </div>
                        ))}
                      </div>
                    )}
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

      {/* PAYMENT SETTLEMENT: the actual transfers needed to make everyone
          even, netted across every receipt (even ones with different
          payers) so nobody has to make unnecessary back-and-forth
          payments -- see lib/splitExpenses.ts's computeSettlements(). */}
      <section aria-labelledby="split-preview-settlements" className="nexali-panel rounded-xl p-5 md:p-6">
        <h2 id="split-preview-settlements" className="font-display text-lg font-semibold text-foreground">
          Who Owes Who
        </h2>
        {settlements.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Everyone is settled up — no payments needed.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {settlements.map((s, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-outline-variant/40 bg-surface-lowest px-4 py-2.5 text-sm text-foreground"
              >
                {/* Direction is stated in plain text ("X owes Y $Z"), never communicated by an icon/arrow alone. */}
                <span>{describeSettlement(s, participants, formatCurrency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Receipts included, with category/total, and the per-receipt transaction preview. */}
      <section aria-labelledby="split-preview-receipts" className="space-y-3">
        <h2 id="split-preview-receipts" className="font-display text-lg font-semibold text-foreground">
          Receipts in this split
        </h2>
        {receipts.map((receipt) => {
          const yourShare = receiptParticipantTotals(receipt).get(YOU_PARTICIPANT_ID) ?? 0;
          const payer = participants.find((p) => p.id === receipt.payerParticipantId);
          return (
            <div key={receipt.id} className="nexali-panel rounded-xl p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{receipt.merchant ?? receipt.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {receipt.categoryName ?? "Uncategorized"}
                    {receipt.purchaseDate && ` · ${formatReceiptDate(receipt.purchaseDate, dateFormat)}`}
                    {payer && ` · Paid by ${participantDisplayName(payer)}`}
                  </p>
                </div>
                <p className="numeric font-semibold text-foreground">
                  {receipt.parsedTotalCents != null ? formatCurrency(centsToDollars(receipt.parsedTotalCents)) : "—"}
                </p>
              </div>

              <div className="mt-3 rounded-lg border border-outline-variant/40 bg-surface-lowest p-3 text-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transaction Preview</p>
                {/*
                  "Your Amount" here is your ALLOCATED SHARE of this receipt,
                  unchanged by payer data -- deliberately NOT redefined to
                  mean "the full amount you personally paid" even when you
                  are the payer. Which of these a real future transaction
                  record should actually represent (economic share vs. full
                  amount paid, plus how/whether reimbursement from other
                  participants gets tracked as separate records) is an
                  explicit open backend design question this frontend phase
                  does not resolve -- see docs/BACKEND_AUDIT_REPORT.md's
                  Split Expenses entry.
                */}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <dt className="text-muted-foreground">Merchant</dt>
                  <dd className="text-right text-foreground">{receipt.merchant ?? "Unknown"}</dd>
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="text-right text-foreground">{receipt.categoryName ?? "Uncategorized"}</dd>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="text-right text-foreground">
                    {receipt.purchaseDate ? formatReceiptDate(receipt.purchaseDate, dateFormat) : "Unknown"}
                  </dd>
                  <dt className="text-muted-foreground">Paid By</dt>
                  <dd className="text-right text-foreground">{payer ? participantDisplayName(payer) : "Unknown"}</dd>
                  <dt className="text-muted-foreground">Your Amount</dt>
                  <dd className="numeric text-right font-semibold text-foreground">{formatCurrency(centsToDollars(yourShare))}</dd>
                </dl>
                <p className="mt-2 text-xs italic text-muted-foreground">Ready to create after submission</p>
              </div>
            </div>
          );
        })}
      </section>

      {submitResult ? (
        <SubmitSuccessBanner result={submitResult} onStartNewSplit={onStartNewSplit} />
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="surface" size="control" onClick={onEdit} disabled={submitMutation.isPending}>
            Edit
          </Button>
          <div className="flex flex-col items-end gap-1.5">
            {!canSubmitToBackend && (
              <p className="text-sm text-warning-foreground">
                Remove manually-added participants before submitting — Split Expenses can only be submitted with real Nexali friends.
              </p>
            )}
            {submitMutation.isError && (
              <StatusBanner variant="error">
                {getErrorMessage(submitMutation.error, "Couldn't submit this split. Please try again.")}
              </StatusBanner>
            )}
            <Button
              type="button"
              variant="hero"
              size="control"
              disabled={submitMutation.isPending || !canSubmitToBackend}
              onClick={() => void handleSubmit()}
            >
              {submitMutation.isPending ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Truthful post-submission confirmation -- uses the REAL server-returned
 * counts, never a claim that every friend's transaction already exists
 * (only the creator's are created immediately; see
 * docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry for why).
 */
function SubmitSuccessBanner({ result, onStartNewSplit }: { result: SubmitSplitExpenseResult; onStartNewSplit: () => void }) {
  const pendingCount = result.participants.filter((p) => p.responseStatus === "pending").length;
  return (
    <div className="nexali-panel rounded-xl p-5 text-center md:p-6">
      <h2 className="font-display text-lg font-semibold text-foreground">Split submitted</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your {result.creatorTransactionCount} Nexali transaction{result.creatorTransactionCount === 1 ? "" : "s"} {result.creatorTransactionCount === 1 ? "was" : "were"} created.
      </p>
      {pendingCount > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {pendingCount} friend{pendingCount === 1 ? "" : "s"} still need{pendingCount === 1 ? "s" : ""} to accept their
          share{pendingCount === 1 ? "" : "s"}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Everyone is already settled — nothing else to do.</p>
      )}
      <Button type="button" variant="surface" size="control" className="mt-4" onClick={onStartNewSplit}>
        Start a New Split
      </Button>
    </div>
  );
}
