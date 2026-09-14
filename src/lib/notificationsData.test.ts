import { describe, it, expect, vi, afterEach } from "vitest";
import { TrendingUp } from "lucide-react";
import {
  dismissNotification,
  getNotificationPreferences,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "./notificationsData";

type ChainResult = { data?: unknown; error: unknown; count?: number | null };

interface SupabaseChainMock extends PromiseLike<ChainResult> {
  select: (...args: unknown[]) => SupabaseChainMock;
  eq: (...args: unknown[]) => SupabaseChainMock;
  is: (...args: unknown[]) => SupabaseChainMock;
  order: (...args: unknown[]) => SupabaseChainMock;
  limit: (...args: unknown[]) => SupabaseChainMock;
  update: (...args: unknown[]) => SupabaseChainMock;
  upsert: (...args: unknown[]) => SupabaseChainMock;
  maybeSingle: (...args: unknown[]) => Promise<ChainResult>;
}

function makeChainable(result: ChainResult): SupabaseChainMock {
  const chain: SupabaseChainMock = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

vi.mock("../supabaseClient", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../supabaseClient";

function mockFrom(result: ChainResult) {
  const chain = makeChainable(result);
  vi.mocked(supabase.from).mockReturnValue(chain as unknown as ReturnType<typeof supabase.from>);
  return chain;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    user_id: "u1",
    type: "financial",
    title: "Budget approaching limit",
    description: "You've used 80% of your Dining budget for September 2026.",
    action_href: "/budgets",
    action_label: "View budget",
    secondary_action_href: null,
    secondary_action_label: null,
    dedupe_key: "budget:1:2026-09:approaching",
    created_at: "2026-09-13T00:00:00.000Z",
    read_at: null,
    dismissed_at: null,
    ...overrides,
  };
}

describe("listNotifications", () => {
  afterEach(() => vi.clearAllMocks());

  it("filters to the caller's own user_id, excludes dismissed, orders newest first, and bounds the result", async () => {
    const chain = mockFrom({ data: [row()], error: null });
    await listNotifications("u1", "all");

    expect(supabase.from).toHaveBeenCalledWith("notifications");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(chain.is).toHaveBeenCalledWith("dismissed_at", null);
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it("applies an unread filter server-side for the 'unread' tab", async () => {
    const chain = mockFrom({ data: [], error: null });
    await listNotifications("u1", "unread");
    expect(chain.is).toHaveBeenCalledWith("read_at", null);
  });

  it("applies a type filter server-side for a category tab", async () => {
    const chain = mockFrom({ data: [], error: null });
    await listNotifications("u1", "security");
    expect(chain.eq).toHaveBeenCalledWith("type", "security");
  });

  it("maps a DB row to NotificationItemData, deriving read from read_at and an icon from type", async () => {
    mockFrom({ data: [row({ read_at: "2026-09-13T01:00:00.000Z" })], error: null });
    const [item] = await listNotifications("u1", "all");

    expect(item.id).toBe("n1");
    expect(item.type).toBe("financial");
    expect(item.icon).toBe(TrendingUp);
    expect(item.read).toBe(true);
    expect(item.primaryAction).toEqual({ href: "/budgets", label: "View budget" });
    expect(item.secondaryAction).toBeUndefined();
  });

  it("returns an empty array when the query returns no rows", async () => {
    mockFrom({ data: null, error: null });
    expect(await listNotifications("u1", "all")).toEqual([]);
  });

  it("throws the real Supabase error rather than swallowing it", async () => {
    mockFrom({ data: null, error: { message: "permission denied" } });
    await expect(listNotifications("u1", "all")).rejects.toBeTruthy();
  });
});

describe("getUnreadNotificationCount", () => {
  afterEach(() => vi.clearAllMocks());

  it("uses a head/count query scoped to this user, non-dismissed, unread", async () => {
    const chain = mockFrom({ data: null, error: null, count: 3 });
    const count = await getUnreadNotificationCount("u1");

    expect(chain.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(chain.is).toHaveBeenCalledWith("dismissed_at", null);
    expect(chain.is).toHaveBeenCalledWith("read_at", null);
    expect(count).toBe(3);
  });

  it("returns 0 rather than null/undefined", async () => {
    mockFrom({ data: null, error: null, count: null });
    expect(await getUnreadNotificationCount("u1")).toBe(0);
  });
});

describe("markNotificationRead", () => {
  afterEach(() => vi.clearAllMocks());

  it("updates read_at for exactly this id AND this user", async () => {
    const chain = mockFrom({ data: null, error: null });
    await markNotificationRead("u1", "n1");

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ read_at: expect.any(String) }));
    expect(chain.eq).toHaveBeenCalledWith("id", "n1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("throws on a real error", async () => {
    mockFrom({ data: null, error: { message: "row not found" } });
    await expect(markNotificationRead("u1", "n1")).rejects.toBeTruthy();
  });
});

describe("markAllNotificationsRead", () => {
  afterEach(() => vi.clearAllMocks());

  it("bulk-updates only this user's non-dismissed unread rows", async () => {
    const chain = mockFrom({ data: null, error: null });
    await markAllNotificationsRead("u1");

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ read_at: expect.any(String) }));
    expect(chain.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(chain.is).toHaveBeenCalledWith("dismissed_at", null);
    expect(chain.is).toHaveBeenCalledWith("read_at", null);
  });
});

describe("dismissNotification", () => {
  afterEach(() => vi.clearAllMocks());

  it("sets dismissed_at for exactly this id AND this user", async () => {
    const chain = mockFrom({ data: null, error: null });
    await dismissNotification("u1", "n1");

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ dismissed_at: expect.any(String) }));
    expect(chain.eq).toHaveBeenCalledWith("id", "n1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "u1");
  });
});

describe("getNotificationPreferences", () => {
  afterEach(() => vi.clearAllMocks());

  it("scopes the read to this user's own row", async () => {
    const chain = mockFrom({
      data: { budget_approaching: true, budget_exceeded: false, monthly_summary: true, account_security: false },
      error: null,
    });
    const prefs = await getNotificationPreferences("u1");

    expect(chain.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(prefs).toEqual({ budget_approaching: true, budget_exceeded: false, monthly_summary: true, account_security: false });
  });

  it("falls back to real default-on preferences if no row is found (defense-in-depth)", async () => {
    mockFrom({ data: null, error: null });
    const prefs = await getNotificationPreferences("u1");
    expect(prefs).toEqual({ budget_approaching: true, budget_exceeded: true, monthly_summary: true, account_security: true });
  });

  it("throws on a real error", async () => {
    mockFrom({ data: null, error: { message: "permission denied" } });
    await expect(getNotificationPreferences("u1")).rejects.toBeTruthy();
  });
});

describe("updateNotificationPreferences", () => {
  afterEach(() => vi.clearAllMocks());

  it("upserts by user_id, carrying only the changed fields plus the owner id", async () => {
    const chain = mockFrom({ data: null, error: null });
    await updateNotificationPreferences("u1", { budget_exceeded: false });

    expect(chain.upsert).toHaveBeenCalledWith({ user_id: "u1", budget_exceeded: false }, { onConflict: "user_id" });
  });

  it("throws on a real error", async () => {
    mockFrom({ data: null, error: { message: "permission denied" } });
    await expect(updateNotificationPreferences("u1", { budget_exceeded: false })).rejects.toBeTruthy();
  });
});
