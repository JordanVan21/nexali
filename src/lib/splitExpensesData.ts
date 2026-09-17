import { supabase } from "../supabaseClient";
import type {
  SubmitSplitExpenseParticipantResult,
  SubmitSplitExpensePayload,
  SubmitSplitExpenseResult,
} from "./splitExpenses";

type RawParticipant = {
  userId: string;
  position: number;
  responseStatus: string;
  allocatedTotalCents: number;
  paidTotalCents: number;
  netCents: number;
};

type RawSettlement = { fromUserId: string; toUserId: string; amountCents: number };

type RawResult = {
  splitId: string;
  status: string;
  currency: string;
  creatorTransactionCount: number;
  participants: RawParticipant[];
  settlements: RawSettlement[];
};

function toResult(raw: RawResult): SubmitSplitExpenseResult {
  return {
    splitId: raw.splitId,
    status: raw.status as SubmitSplitExpenseResult["status"],
    currency: raw.currency,
    creatorTransactionCount: raw.creatorTransactionCount,
    participants: raw.participants.map(
      (p): SubmitSplitExpenseParticipantResult => ({
        userId: p.userId,
        position: p.position,
        responseStatus: p.responseStatus as SubmitSplitExpenseParticipantResult["responseStatus"],
        allocatedTotalCents: p.allocatedTotalCents,
        paidTotalCents: p.paidTotalCents,
        netCents: p.netCents,
      })
    ),
    settlements: raw.settlements.map((s) => ({
      fromParticipantId: s.fromUserId,
      toParticipantId: s.toUserId,
      amountCents: s.amountCents,
    })),
  };
}

/**
 * Submits a split to the real backend -- the ONE authoritative RPC (see
 * docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry). The creator's own
 * generated transactions are created in the same atomic call; other
 * participants' are created only when THEY accept (see
 * acceptSplitExpense() below). Retrying with the SAME payload.idempotencyKey
 * (a double-click, a network retry) never creates a duplicate -- the RPC
 * returns the original result instead.
 */
export async function submitSplitExpense(payload: SubmitSplitExpensePayload): Promise<SubmitSplitExpenseResult> {
  const { data, error } = await supabase.rpc("submit_split_expense", { p_payload: payload });
  if (error) throw error;
  return toResult(data as unknown as RawResult);
}

/** Creates ONLY the calling participant's own generated transactions -- derived from auth.uid() server-side, never callable on another user's behalf. */
export async function acceptSplitExpense(splitId: string): Promise<SubmitSplitExpenseResult> {
  const { data, error } = await supabase.rpc("accept_split_expense", { p_split_id: splitId });
  if (error) throw error;
  return toResult(data as unknown as RawResult);
}

/** Declines the calling participant's own pending share -- creates no transactions. */
export async function declineSplitExpense(splitId: string): Promise<SubmitSplitExpenseResult> {
  const { data, error } = await supabase.rpc("decline_split_expense", { p_split_id: splitId });
  if (error) throw error;
  return toResult(data as unknown as RawResult);
}
