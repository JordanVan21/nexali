import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { UserIdProvider } from "../shared/userIdContext";
import { WithErrorBoundary } from "../ErrorBoundary";
import type { DashboardSummaryResponse } from "../lib/financialAggregates";
import type { ProfileSelect } from "../lib/profile";

/**
 * Regression coverage for a real bug: `useProfile`'s query -- shared by
 * every consumer via the same qk.profile(userId) cache key -- genuinely
 * failing (e.g. because a Part 6 migration adding new profiles columns
 * hadn't been deployed yet, so the SELECT itself errored) used to replace
 * the ENTIRE Dashboard page with "Couldn't load your profile" once the
 * query's retries were exhausted (a few seconds after the page had
 * already rendered normally otherwise). Profile data on Dashboard only
 * ever backed the personalized greeting, which already had a real
 * fallback -- every other real Dashboard dependency (the summary/budgets
 * queries) already has its own independent error state. This file proves
 * Dashboard now tolerates a genuinely failing profile query the same way
 * every other real profile consumer in the app (ProfileMenu,
 * TransactionFilterBar, Reports, ...) always has.
 */

vi.mock("../lib/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/profile")>();
  return { ...actual, getProfile: (...args: unknown[]) => getProfileMock(...args) };
});

const getDashboardSummaryMock = vi.fn();
const getBudgetsProgressMock = vi.fn();
const getBudgetsMock = vi.fn();
const getProfileMock = vi.fn();

vi.mock("../lib/financialAggregates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/financialAggregates")>();
  return {
    ...actual,
    getDashboardSummary: (...args: unknown[]) => getDashboardSummaryMock(...args),
    getBudgetsProgress: (...args: unknown[]) => getBudgetsProgressMock(...args),
  };
});

vi.mock("../lib/budgets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/budgets")>();
  return { ...actual, getBudgets: (...args: unknown[]) => getBudgetsMock(...args) };
});

vi.mock("../features/transactions/useTransactions", () => ({
  useSaveTransaction: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
}));

vi.mock("../features/categories/useCategories", () => ({
  useListCategories: () => ({ data: [], isLoading: false, isFetching: false, isError: false, error: null }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function defaultSummary(): DashboardSummaryResponse {
  return {
    month: { income: 3000, expenses: 150, net: 2850 },
    prevMonth: { income: 0, expenses: 0 },
    cashflow: [],
    categoryBreakdown: [],
    recentTransactions: [
      {
        id: 1,
        amount: 150,
        merchant: "Whole Foods",
        note: null,
        created_at: "2024-01-05T00:00:00.000Z",
        occurred_at: "2024-01-05T12:00:00.000Z",
        category_id: 1,
        categories: { id: 1, name: "Groceries", type: "expense" },
      },
    ],
    currentYear: 2024,
    currentMonth: 1,
  };
}

function fullProfile(): ProfileSelect {
  return {
    full_name: "Jamie Rivera",
    avatar_url: null,
    budget_reset_cycle: "monthly",
    reset_day: 1,
    timezone: "America/Los_Angeles",
    phone: null,
    location: null,
    financial_bio: null,
    currency: "USD",
    date_format: "mdy",
    number_format: "standard",
  };
}

function renderDashboard(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <UserIdProvider value={{ userId: "test-user-id", email: "test@example.com" }}>
          <WithErrorBoundary>
            <Dashboard />
          </WithErrorBoundary>
        </UserIdProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function seedDashboardData() {
  getDashboardSummaryMock.mockResolvedValue(defaultSummary());
  getBudgetsMock.mockResolvedValue([]);
  getBudgetsProgressMock.mockResolvedValue([]);
}

describe("Dashboard tolerates a failing/slow profile query (regression)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("1. cold profile query (still pending): Dashboard's real content still renders, not gated on profile", async () => {
    seedDashboardData();
    let resolveProfile!: (v: ProfileSelect) => void;
    getProfileMock.mockReturnValue(new Promise((res) => (resolveProfile = res)));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderDashboard(queryClient);

    await waitFor(() => expect(screen.getByText("$3,000.00")).toBeInTheDocument());
    // Falls back to the generic (no-name) greeting while profile is still pending.
    expect(screen.getByText("An overview of your recent financial activity.")).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load your profile/i)).not.toBeInTheDocument();

    await act(async () => {
      resolveProfile(fullProfile());
    });
  });

  it("2. profile successfully resolves: the personalized greeting appears", async () => {
    seedDashboardData();
    getProfileMock.mockResolvedValue(fullProfile());

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderDashboard(queryClient);

    await waitFor(() => expect(screen.getByText(/welcome back, jamie/i)).toBeInTheDocument());
  });

  it("3. profile genuinely errors: Dashboard's real financial content still renders -- no full-page 'Couldn't load your profile'", async () => {
    seedDashboardData();
    getProfileMock.mockRejectedValue(new Error("column profiles.phone does not exist"));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderDashboard(queryClient);

    await waitFor(() => expect(screen.getByText("$3,000.00")).toBeInTheDocument());
    await waitFor(() => expect(getProfileMock).toHaveBeenCalled());

    expect(screen.queryByText(/couldn't load your profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/we couldn't load your account/i)).not.toBeInTheDocument();
    // Real Dashboard content (summary cards, budget panel) is still fully present.
    expect(screen.getByText("Income (This Month)")).toBeInTheDocument();
    expect(screen.getByText("An overview of your recent financial activity.")).toBeInTheDocument();
  });

  it("4. profile query takes several seconds to fail: Dashboard content is not held hostage while it's in flight, and still survives once it settles", async () => {
    seedDashboardData();
    const deferred = new Promise<ProfileSelect>((_, reject) => {
      setTimeout(() => reject(new Error("network timeout")), 50);
    });
    getProfileMock.mockReturnValue(deferred);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderDashboard(queryClient);

    // Real content is already visible well before the slow profile query settles.
    await waitFor(() => expect(screen.getByText("$3,000.00")).toBeInTheDocument());
    expect(screen.queryByText(/couldn't load your profile/i)).not.toBeInTheDocument();

    // ...and once the slow query finally rejects, the page still doesn't flip to the profile error.
    await new Promise((r) => setTimeout(r, 80));
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load your profile/i)).not.toBeInTheDocument();
  });

  it("5. re-mounting Dashboard (simulating navigating away and back) does not mask or change the outcome of an already-failed profile query", async () => {
    seedDashboardData();
    getProfileMock.mockRejectedValue(new Error("column profiles.phone does not exist"));

    // One shared QueryClient across both mounts, exactly like one real app session.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const first = renderDashboard(queryClient);
    await waitFor(() => expect(getProfileMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("$3,000.00")).toBeInTheDocument());
    expect(screen.queryByText(/couldn't load your profile/i)).not.toBeInTheDocument();
    first.unmount();

    // Re-mount (as if navigating to /budgets and back to /dashboard) -- the
    // cached profile error is already known; Dashboard must still render
    // its real content rather than surfacing it as a page-level failure.
    renderDashboard(queryClient);
    await waitFor(() => expect(screen.getByText("$3,000.00")).toBeInTheDocument());
    expect(screen.queryByText(/couldn't load your profile/i)).not.toBeInTheDocument();
  });

  it("6. query retry behavior: a real (short-delay) retry configuration retries before settling into error, and Dashboard still tolerates the eventual failure", async () => {
    seedDashboardData();
    getProfileMock.mockRejectedValue(new Error("column profiles.phone does not exist"));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 2, retryDelay: 5 } },
    });
    renderDashboard(queryClient);

    await waitFor(() => expect(getProfileMock.mock.calls.length).toBeGreaterThan(1), { timeout: 2000 });
    await waitFor(() => expect(screen.getByText("$3,000.00")).toBeInTheDocument());
    expect(screen.queryByText(/couldn't load your profile/i)).not.toBeInTheDocument();
  });
});
