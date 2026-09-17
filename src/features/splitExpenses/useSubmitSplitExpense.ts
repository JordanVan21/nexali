import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "../querykeys";
import { acceptSplitExpense, declineSplitExpense, submitSplitExpense } from "../../lib/splitExpensesData";

/**
 * Invalidates every cache a newly-created transaction can affect, using
 * the SAME set the rest of this codebase already invalidates after any
 * real transaction mutation (see e.g. useTransactions.ts) -- never a
 * parallel, independently-invented list. Shared by both the creator's
 * immediate submission and a participant's later acceptance, since both
 * are "a real transaction now exists for this user" events.
 */
function invalidateFinancialCaches(qc: ReturnType<typeof useQueryClient>, userId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.txRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.dashboardSummary(userId) }),
    qc.invalidateQueries({ queryKey: qk.reportsSummaryRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.budgetsProgressRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.categoryCounts(userId) }),
    qc.invalidateQueries({ queryKey: qk.activitySummaryRoot(userId) }),
  ]);
}

function invalidateNotificationCaches(qc: ReturnType<typeof useQueryClient>, userId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.notificationsRoot(userId) }),
    qc.invalidateQueries({ queryKey: qk.notificationsUnreadCount(userId) }),
  ]);
}

/**
 * The creator's own submission -- their generated transactions are
 * created immediately, in the same atomic RPC call, so this invalidates
 * every financial cache exactly like any other new-transaction mutation,
 * plus the Split-specific namespace. The creator does not receive a
 * notification for their own submission, so notifications are
 * deliberately NOT invalidated here.
 */
export function useSubmitSplitExpense(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitSplitExpense,
    onSuccess: async () => {
      if (!userId) return;
      await Promise.all([invalidateFinancialCaches(qc, userId), qc.invalidateQueries({ queryKey: qk.splitRoot(userId) })]);
    },
  });
}

/** Accepting creates the accepting participant's OWN transactions -- same financial-cache invalidation as submit, plus notifications (their split_expense notification is resolved) and Split status. */
export function useAcceptSplitExpense(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acceptSplitExpense,
    onSuccess: async () => {
      if (!userId) return;
      await Promise.all([
        invalidateFinancialCaches(qc, userId),
        invalidateNotificationCaches(qc, userId),
        qc.invalidateQueries({ queryKey: qk.splitRoot(userId) }),
      ]);
    },
  });
}

/** Declining creates no transaction -- financial aggregates are deliberately NOT invalidated (nothing changed). Only notifications (resolved) and Split status. */
export function useDeclineSplitExpense(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: declineSplitExpense,
    onSuccess: async () => {
      if (!userId) return;
      await Promise.all([invalidateNotificationCaches(qc, userId), qc.invalidateQueries({ queryKey: qk.splitRoot(userId) })]);
    },
  });
}
