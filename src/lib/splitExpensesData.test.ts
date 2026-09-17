import { describe, it, expect, vi, afterEach } from "vitest";
import { acceptSplitExpense, declineSplitExpense, submitSplitExpense } from "./splitExpensesData";
import type { SubmitSplitExpensePayload } from "./splitExpenses";

vi.mock("../supabaseClient", () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from "../supabaseClient";

function payload(): SubmitSplitExpensePayload {
  return { idempotencyKey: "key-1", currency: "USD", participants: [{ userId: "u1", position: 0 }], receipts: [] };
}

function rawResult() {
  return {
    splitId: "s1",
    status: "submitted",
    currency: "USD",
    creatorTransactionCount: 2,
    participants: [
      { userId: "u1", position: 0, responseStatus: "accepted", allocatedTotalCents: 1000, paidTotalCents: 2000, netCents: 1000 },
    ],
    settlements: [{ fromUserId: "u2", toUserId: "u1", amountCents: 500 }],
  };
}

describe("submitSplitExpense", () => {
  afterEach(() => vi.clearAllMocks());

  it("calls submit_split_expense with exactly p_payload", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rawResult(), error: null } as never);
    await submitSplitExpense(payload());
    expect(supabase.rpc).toHaveBeenCalledWith("submit_split_expense", { p_payload: payload() });
  });

  it("maps the raw server response (snake/camel RPC field names) onto the typed result, including settlements as fromParticipantId/toParticipantId", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rawResult(), error: null } as never);
    const result = await submitSplitExpense(payload());

    expect(result.splitId).toBe("s1");
    expect(result.creatorTransactionCount).toBe(2);
    expect(result.participants[0]).toEqual({
      userId: "u1",
      position: 0,
      responseStatus: "accepted",
      allocatedTotalCents: 1000,
      paidTotalCents: 2000,
      netCents: 1000,
    });
    expect(result.settlements[0]).toEqual({ fromParticipantId: "u2", toParticipantId: "u1", amountCents: 500 });
  });

  it("throws the real server error rather than swallowing it (e.g. a validation rejection)", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "Split totals do not reconcile" } } as never);
    await expect(submitSplitExpense(payload())).rejects.toBeTruthy();
  });
});

describe("acceptSplitExpense / declineSplitExpense", () => {
  afterEach(() => vi.clearAllMocks());

  it("acceptSplitExpense calls accept_split_expense with only the split id", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rawResult(), error: null } as never);
    await acceptSplitExpense("split-1");
    expect(supabase.rpc).toHaveBeenCalledWith("accept_split_expense", { p_split_id: "split-1" });
  });

  it("declineSplitExpense calls decline_split_expense with only the split id", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rawResult(), error: null } as never);
    await declineSplitExpense("split-1");
    expect(supabase.rpc).toHaveBeenCalledWith("decline_split_expense", { p_split_id: "split-1" });
  });

  it("both throw the real server error rather than swallowing it", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "You are not a participant in this split expense" } } as never);
    await expect(acceptSplitExpense("x")).rejects.toBeTruthy();
    await expect(declineSplitExpense("x")).rejects.toBeTruthy();
  });
});
