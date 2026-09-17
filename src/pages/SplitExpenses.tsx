import { Receipt } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/states/EmptyState";
import { ReceiptUploadArea } from "../components/splitExpenses/ReceiptUploadArea";
import { ReceiptCard } from "../components/splitExpenses/ReceiptCard";
import { ParticipantsBar } from "../components/splitExpenses/ParticipantsBar";
import { SplitSummaryCard } from "../components/splitExpenses/SplitSummaryCard";
import { SplitStepIndicator, type SplitStep } from "../components/splitExpenses/SplitStepIndicator";
import { SplitPreview } from "../components/splitExpenses/SplitPreview";
import { useSplitExpensesState } from "../features/splitExpenses/useSplitExpensesState";
import { useListFriends } from "../features/friends/useFriendsQueries";
import { useUserInfo } from "../shared/useUserId";

/**
 * Split Expenses. Receipts/participants/assignments/the local settlement
 * preview all live in useSplitExpensesState()'s in-memory React state
 * (cleared on navigating away, or via resetSplit() after a successful
 * submission) -- nothing is written to Supabase until the user reaches
 * Preview and clicks the real Submit button (see SplitPreview.tsx and
 * docs/BACKEND_AUDIT_REPORT.md's Split Expenses entry for the full
 * submit_split_expense() backend writeup). "Process Split" only switches
 * this page into the read-only Preview mode -- Submit is the one real
 * write.
 */
export default function SplitExpenses() {
  const { userId } = useUserInfo();
  const state = useSplitExpensesState();
  // Reuses the SAME cached list_friends() query the /friends page uses (see
  // features/friends/useFriendsQueries.ts) -- no second Friends fetch
  // implementation. Started here (page-level, not deferred to when the
  // picker opens) so opening FriendAutocomplete is instant whenever this
  // data is already warm in the TanStack Query cache.
  const friendsQuery = useListFriends(userId);

  const step: SplitStep = state.mode === "preview" ? "Preview" : state.receipts.length === 0 ? "Receipts" : "Assign";

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[36px] lg:text-[44px] xl:text-[48px]">
            Split Expenses
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground sm:text-base lg:text-lg xl:text-xl">
            Split receipt purchases fairly between you and your friends.
          </p>
        </div>
        <SplitStepIndicator current={step} />
      </div>

      <div className="mx-auto mt-6 max-w-[900px] space-y-6 md:mt-8 md:space-y-8">
        {state.mode === "preview" ? (
          <SplitPreview
            receipts={state.receipts}
            participants={state.participants}
            onEdit={state.editSplit}
            onStartNewSplit={state.resetSplit}
            userId={userId}
            idempotencyKey={state.idempotencyKey}
          />
        ) : (
          <>
            <ReceiptUploadArea onFilesSelected={state.addReceipts} />

            {state.receipts.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No receipts yet"
                description="Add a receipt above to start splitting a purchase with friends."
              />
            ) : (
              <div className="space-y-4">
                {state.receipts.map((receipt) => (
                  <ReceiptCard
                    key={receipt.id}
                    receipt={receipt}
                    userId={userId}
                    participants={state.participants}
                    onRemove={() => state.removeReceipt(receipt.id)}
                    onToggleCollapsed={() => state.toggleReceiptCollapsed(receipt.id)}
                    onCategoryChange={(categoryId, categoryName) => state.setReceiptCategory(receipt.id, categoryId, categoryName)}
                    onItemAssignmentChange={(itemId, assignment) => state.setItemAssignment(receipt.id, itemId, assignment)}
                    onSetAllMine={() => state.setAllItemsMine(receipt.id)}
                    onPayerChange={(participantId) => state.setReceiptPayer(receipt.id, participantId)}
                  />
                ))}
              </div>
            )}

            <ParticipantsBar
              participants={state.participants}
              receipts={state.receipts}
              friends={friendsQuery.data}
              friendsLoading={friendsQuery.isLoading}
              friendsError={friendsQuery.isError}
              friendsErrorValue={friendsQuery.error}
              onRetryFriends={() => friendsQuery.refetch()}
              onAddFriend={state.addFriendParticipant}
              onAddManualPerson={state.addParticipant}
              onRemoveParticipant={state.removeParticipant}
            />

            {state.receipts.length > 0 && <SplitSummaryCard receipts={state.receipts} participants={state.participants} />}

            <div className="flex flex-col items-end gap-2">
              {state.blockReason && (
                <p role="status" className="text-sm text-muted-foreground">
                  {state.blockReason}
                </p>
              )}
              <Button type="button" variant="hero" size="control" disabled={!state.canProcess} onClick={state.process}>
                Process Split
              </Button>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}
