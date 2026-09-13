import { useState } from "react";
import { Link } from "react-router-dom";
import { AtSign, Shield, ShieldAlert } from "lucide-react";
import { PageContainer } from "../components/shell/PageContainer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/states/Skeleton";
import { ErrorState } from "../components/states/ErrorState";
import { DeleteAccountDialog } from "../components/DeleteAccountDialog";
import { useUser } from "../features/user/userUser";
import { useSignOut } from "../features/user/useSignOut";
import { useDeleteUser } from "../features/profiles/useDeleteUser";
import { PUBLIC_ROUTES } from "../lib/routes";
import { getErrorMessage } from "../lib/utils";

function AccountSkeleton() {
  return (
    <PageContainer>
      <div aria-hidden="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
        <div className="mx-auto mt-6 max-w-[1200px] space-y-6 md:mt-8 md:space-y-8">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading account…</span>
    </PageContainer>
  );
}

/**
 * Real Supabase Auth identity + security. Deliberately does not duplicate
 * Profile (avatar/name/contact/financial bio) or Settings (app preferences) --
 * see docs/FRONTEND_REVAMP_PLAN.md for the split. Lovable's account.tsx also
 * ships mock active-sessions, connected-accounts, two-factor and data-export
 * sections; none of those have a real backend today, so they're omitted here
 * rather than presented as if they work.
 */
export default function Account() {
  const { data: authUser, isLoading, isError, refetch } = useUser();
  const signOut = useSignOut();
  const deleteUser = useDeleteUser();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return <AccountSkeleton />;
  }

  if (isError || !authUser) {
    return (
      <PageContainer>
        <ErrorState
          title="Couldn't load your account"
          message="Please check your connection and try again."
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  const email = authUser.email ?? "";
  const memberSince =
    authUser.created_at &&
    new Date(authUser.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const handleDeleteConfirm = () => {
    if (deleteUser.isPending) return;
    deleteUser.mutate(undefined, {
      onSuccess: async () => {
        setDeleteOpen(false);
        await signOut();
      },
    });
  };

  return (
    <PageContainer>
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[36px] lg:text-[44px] xl:text-[48px]">
          Account
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground sm:text-base lg:text-lg xl:text-xl">
          Manage your sign-in email, password and account deletion.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-[1200px] space-y-6 md:mt-8 md:space-y-8">
        <section>
          <div className="mb-3 flex items-center gap-2 xl:mb-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <AtSign className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground xl:text-xl">Sign-in information</h2>
          </div>
          <div className="nexali-panel rounded-xl p-5 md:p-6 xl:p-7">
            <div className="space-y-2">
              <Label htmlFor="account-email" className="md:text-[15px]">
                Current email
              </Label>
              <Input
                id="account-email"
                type="email"
                value={email}
                readOnly
                disabled
                className="h-11 cursor-not-allowed bg-muted text-base md:text-base xl:h-12"
              />
              <p className="text-sm italic text-muted-foreground">Contact support to change your sign-in email.</p>
            </div>
            {memberSince && (
              <p className="mt-4 text-sm text-muted-foreground">Member since {memberSince}.</p>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 xl:mb-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Shield className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-display text-lg font-semibold text-foreground xl:text-xl">Password &amp; security</h2>
          </div>
          <div className="nexali-panel rounded-xl p-5 md:p-6 xl:p-7">
            <p className="mb-4 text-sm text-muted-foreground">
              Reset your password by email. You'll be signed out on other devices once it's changed.
            </p>
            <Button asChild variant="surface" size="control">
              <Link to={PUBLIC_ROUTES.forgotPassword}>Change password</Link>
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 md:p-6 xl:p-7">
          <div className="mb-3 flex items-center gap-2 xl:mb-4">
            <ShieldAlert className="h-5 w-5 text-destructive" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-destructive xl:text-xl">Danger zone</h2>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            Deleting your account permanently erases your transactions, budgets, categories and
            profile. This action is irreversible.
          </p>
          <Button
            type="button"
            variant="destructive"
            size="control"
            className="w-full sm:w-auto"
            onClick={() => setDeleteOpen(true)}
          >
            Delete my account
          </Button>
        </section>
      </div>

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteConfirm}
        isPending={deleteUser.isPending}
        errorMessage={deleteUser.isError ? getErrorMessage(deleteUser.error, "Failed to delete your account.") : null}
      />
    </PageContainer>
  );
}
