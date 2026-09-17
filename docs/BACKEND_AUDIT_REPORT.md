# Nexali — Backend Audit Report (Backend Part 1)

**Date:** 2026-09-13
**Branch:** `lovable-visual-redesign`
**Scope:** Read-only audit of current database schema, RLS, RPCs, Storage, Edge Functions, and every frontend data-access path. No schema changes, no migrations applied, no destructive commands run. One read-only command was run against the live project: `npx supabase migration list` (confirms which migrations are actually deployed remotely — see §4).

This document supersedes the Supabase-related sections of `docs/AUDIT_REPORT.md` (dated 2026-07-29, pre-dates migrations existing at all, pre-dates the Lovable frontend redesign, and pre-dates Sign Out/Reports/Settings/Forgot-Password/Reset-Password/Email-Verification being built). Where the two disagree, **this document reflects current code** and says so explicitly.

---

## 1. Current Architecture

```
main.tsx          Router + QueryClientProvider
  └── AuthGate     useUser() (react-query) → redirect to /signin when unauthenticated
        └── UserIdProvider   { userId, email }
              └── AppLayout  AppNav (desktop) / MobileNav (bottom) + <Outlet/>
                    └── pages/*
                          └── features/*   TanStack Query hooks
                                └── lib/*  thin Supabase data-access functions
                                      └── supabaseClient.ts (anon key only)
```

Backend surface, in full:
- **2 migrations**, applied in order, both confirmed deployed to the live project (§4).
- **4 tables**: `profiles`, `categories`, `transactions`, `budgets`. No other tables exist (no `notifications`, no `ai_*`, no anything else).
- **1 view**: `v_tx_search` (`security_invoker = on`).
- **5 RPCs**: `delete_user_everything`, `handle_new_user` (trigger only), `is_valid_tz`, `sum_category_amount`, `sum_expense_amount`, `sum_income_amount`.
- **1 Storage bucket**: `avatars` (public URLs), with 4 `storage.objects` policies.
- **1 Edge Function**: `delete-user`. No other Edge Functions exist. No AI provider integration exists anywhere in the repo (verified by grep — zero references to any AI provider, no `ai-assistant` function, no non-Supabase API key of any kind).

---

## 2. Database Schema (traced from migrations + `database.types.ts`, cross-checked, no drift found)

### `profiles`
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | no | — | PK, FK → `auth.users(id)` |
| `full_name` | text | yes | — | |
| `avatar_url` | text | yes | — | |
| `created_at` | timestamp **without** time zone | yes | `now()` | Inconsistent with `transactions.created_at` (see §25) |
| `budget_reset_cycle` | text | no | `'month'` | **No enum/CHECK.** Frontend `<Select>` only offers `weekly/monthly/quarterly/yearly` — the column default `'month'` matches none of them (see §25, P1) |
| `reset_day` | integer | no | `1` | **No CHECK.** Frontend caps 1–31 client-side only |
| `timezone` | text | no | `'America/Los_Angeles'` | CHECK `is_valid_tz(timezone)` — real, DB-enforced |

RLS: enabled. SELECT/INSERT/UPDATE/DELETE all scoped `auth.uid() = id`. No policy allows reading another user's profile.

### `categories`
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | integer (serial) | no | — | PK |
| `name` | text | no | — | |
| `type` | text | no | — | CHECK `IN ('income','expense')` |
| `user_id` | uuid | **yes** | — | `NULL` = global category, FK → `auth.users(id)` ON DELETE CASCADE |
| `created_at` | timestamptz-ish (`timestamp without time zone`) | yes | `now()` | |

Four overlapping unique indexes exist: `categories_global_unique` (name,type WHERE user_id IS NULL), `categories_personal_unique` (user_id,name,type WHERE user_id IS NOT NULL), `categories_user_name_type_uidx` (user_id,name,type, no WHERE), `categories_user_type_name_unique` (user_id,type,lower(name)). The last is the one actually doing case-insensitive work; the other three look like superseded debugging leftovers (P3, §24).

RLS: enabled. SELECT allows `user_id IS NULL OR user_id = auth.uid()` (global + own). INSERT/UPDATE/DELETE scoped to own rows only.

### `transactions`
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | integer (serial) | no | — | PK |
| `user_id` | uuid | no | — | FK → `auth.users(id)` ON DELETE CASCADE |
| `amount` | numeric(10,2) | no | — | CHECK `> 0` (sign never encodes income/expense — that's `categories.type`) |
| `category_id` | integer | yes | — | FK → `categories(id)` ON DELETE SET NULL |
| `note` | text | yes | — | |
| `created_at` | timestamp **with** time zone | yes | `now()` | **This is the only date field — see §5** |
| `merchant` | text | yes | — | |

RLS: enabled, standard `auth.uid() = user_id` on all four operations. No cross-user access possible.

### `budgets`
| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | integer (serial) | no | — | PK |
| `user_id` | uuid | no | — | FK → `auth.users(id)` ON DELETE CASCADE |
| `amount` | numeric(10,2) | no | — | CHECK `> 0` |
| `category_id` | integer | yes | — | FK → `categories(id)` ON DELETE SET NULL |
| `month` | integer | no | — | CHECK `1–12` |
| `year` | integer | no | — | **No CHECK at all** — any integer accepted |
| `created_at` | timestamp without time zone | yes | `now()` | |

UNIQUE `(user_id, category_id, month, year)` **exists** (contradicts the 2026-07-29 audit, which said no such constraint existed — this has been fixed since). Caveat: Postgres treats `NULL` as distinct in unique constraints, so multiple budgets with `category_id IS NULL` for the same user/month/year would **not** violate this constraint. Whether the frontend ever creates a `category_id: null` budget needs a one-line check in the next backend part (`TransactionDialog`/budget form appear to always require a category, but this hasn't been independently re-verified against every code path).

RLS: enabled, standard `auth.uid() = user_id` on all four operations.

### `v_tx_search` (view)
```sql
CREATE VIEW v_tx_search WITH (security_invoker='on') AS
SELECT t.id, t.user_id, t.amount, t.category_id, t.merchant, t.note, t.created_at,
       c.name AS category_name, c.type AS category_type
FROM transactions t LEFT JOIN categories c ON c.id = t.category_id;
```
`security_invoker = on` means RLS on the underlying `transactions`/`categories` tables **is** enforced when queried through the view — confirmed by reading the view definition directly (not inferred). `user_id` is exposed as a column but every current call site filters by it anyway; RLS makes that filter redundant-but-harmless rather than load-bearing. No full-text index; the frontend's "search" is `.or(merchant.ilike.%x%,note.ilike.%x%)` (see §7). No total-count mechanism is used anywhere against this view (see §7 — this is the root cause of the pagination bug).

---

## 3. Foreign Keys / Delete Behavior — full table

| Constraint | Table.column | References | ON DELETE |
|---|---|---|---|
| `budgets_category_id_fkey` | `budgets.category_id` | `categories(id)` | SET NULL |
| `budgets_user_id_fkey` | `budgets.user_id` | `auth.users(id)` | **CASCADE** |
| `categories_user_id_fkey` | `categories.user_id` | `auth.users(id)` | **CASCADE** |
| `profiles_id_fkey` | `profiles.id` | `auth.users(id)` | **CASCADE** (after the fix migration — see §4) |
| `transactions_category_id_fkey` | `transactions.category_id` | `categories(id)` | SET NULL |
| `transactions_user_id_fkey` | `transactions.user_id` | `auth.users(id)` | **CASCADE** |

All four user-owned tables now cascade correctly from `auth.users` deletion. This means even a direct `auth.admin.deleteUser()` call with **no** prior RPC cleanup would now leave no orphaned `budgets`/`categories`/`profiles`/`transactions` rows — a meaningful defense-in-depth improvement over the original schema.

---

## 4. `profiles_id_fkey` — Migration Exists vs. Confirmed Deployed

- **Repo migration exists:** `supabase/migrations/20260910235733_fix_profiles_user_delete_cascade.sql` — drops `profiles_id_fkey` and recreates it with `ON DELETE CASCADE`. Ordered after the baseline (`20260910235021_...`), so it applies second.
- **Confirmed deployed:** I ran the **read-only** command `npx supabase migration list`, which connects to the linked remote project and compares local vs. remote migration history without altering anything. Output:
  ```json
  {"migrations":[
    {"local":"20260910235021","remote":"20260910235021","time":"2026-09-10 23:50:21"},
    {"local":"20260910235733","remote":"20260910235733","time":"2026-09-10 23:57:33"}
  ]}
  ```
  Both migrations show matching `local`/`remote` timestamps, meaning **both are actually applied to the live database**, not just present in the repo. This is real evidence, not an assumption from file presence alone.
- **Conclusion:** `profiles_id_fkey` is `ON DELETE CASCADE` **on the live database today**. The historical concern is **FIXED and CONFIRMED**, with actual proof rather than inference.
- Practical note: even before this fix, the real account-deletion path (`delete_user_everything` RPC) already did explicit `DELETE FROM profiles` regardless of FK cascade behavior, so the FK gap was always a defense-in-depth issue for *other* deletion paths (e.g. deleting the `auth.users` row directly from the Supabase dashboard) rather than a live bug in the app's own delete flow. It is now closed either way.

---

## 5. Transaction Date — Confirmed Still `created_at`

There is **no** `occurred_at`, `transaction_date`, or any dedicated date column on `transactions`. The only timestamp is `created_at timestamptz default now()`, and it is used everywhere as if it were the transaction's financial date:

- **Insert** (`src/lib/transactions.ts` `upsertTransaction`): explicitly stamps `created_at: new Date().toISOString()` on create; **update never touches it** (an edited transaction keeps its original insert timestamp, which is at least internally consistent, but there is no way to backdate a transaction to when it actually happened).
- **Dashboard / Reports / Budgets**: all period math (`src/lib/financialPeriods.ts`, `budgetMath.ts`, `dashboardMath.ts`) filters and buckets by `created_at`.
- **Transactions page filtering/sorting**: `fromISO`/`toISO` range filters and the default "date" sort both operate on `created_at`.
- **CSV export**: exports `created_at` as the row's date.
- **Aura (future)**: any "what did I spend in June" tool would inherit this same limitation — it cannot distinguish "entered in June" from "actually happened in June" because there is only one timestamp.

**Impact today:** low for a user who logs transactions same-day, but the app has no way to represent backdated or batch-imported historical transactions correctly. This is an unfixed, real architectural gap — confirmed present, not fixed.

---

## 6–8. Transaction Query Architecture, Pagination, and Row-Cap Exposure

Two independent query paths exist, and **only one of them is capped by application code**:

### Path A — `fetchTransactions(userId)` (`src/lib/transactions.ts`)
- Table: `transactions` (not the view), joined to `categories` via PostgREST embed.
- Filter: `.eq("user_id", userId)` only.
- Order: `created_at desc`.
- **No `.range()`, no `.limit()`, no count option.** Fully "unbounded" from the application's perspective.
- Used by: `useTransactions()` → **Dashboard** (`useDashboardData`), **Reports** (`useReportsData`), **Budgets** (`useBudgetsForPeriod`), and `TransactionAnalytics` (Average Daily Burn / Top Categories on the Transactions page). All period-scoped math across the whole app is computed **client-side** against this single query's result.
- Query key: `qk.transactions(userId)`, `staleTime: 60_000`.

### Path B — `transactionsWithFilters(userId, filters)` (`src/lib/transactions.ts`)
- Table: `v_tx_search`.
- Filters: date range, category names, types, min/max amount, `.or(merchant.ilike / note.ilike)` search.
- Order: by `sortBy`/`sortOrder`.
- **Explicit `.range(offset, offset + limit - 1)`**, with `limit = filters.limit ?? 50` (default set in `normalizeFilters`, `src/features/querykeys.ts`).
- **No `{ count: 'exact' }`** is ever requested — the query has no way to know the true total row count, only the rows in the fetched page.
- Used by: `useTransactionWithFilters()` → the **Transactions page table** and its **CSV export** (both wired through `Transactions.tsx`).
- `offset` is **never changed** anywhere in the frontend — `Transactions.tsx`'s `DEFAULT_FILTERS` never sets it, so this path only ever fetches rows 0–49 of whatever matches the current filters, server-side, permanently.

### The double-pagination bug — confirmed present, exact mechanism

`TransactionTable.tsx` then takes that already-capped-at-50 array and paginates it **again**, entirely client-side:
```ts
const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
const currentTransactions = transactions.slice(startIndex, endIndex);
// footer text:
`${startIndex + 1}-${Math.min(endIndex, transactions.length)} of ${transactions.length}`
```
`transactions.length` is the size of the **server page** (≤50), never the true match count. Concrete outcomes for the requested scenarios (default `pageSize = 10`):

| True matching rows | What the server returns | What the footer says | What's actually reachable |
|---|---|---|---|
| 25 | 25 (under the 50 cap) | "...of 25" — **correct** | All 25, correctly paginated |
| 50 | 50 (exactly at the cap) | "...of 50" — **correct** | All 50, correctly paginated |
| 75 | 50 (first 50 by sort order) | "...of 50" — **wrong**, undercounts by 25 | Rows 51–75 are **permanently unreachable** — no UI control ever advances the server offset |
| 200 | 50 | "...of 50" — **wrong**, undercounts by 150 | 150 real transactions invisible to the table, the footer, and CSV export |

The CSV export button already carries an honest tooltip — `"Export the transactions currently shown (up to 50 matching rows) as CSV"` — so export's limitation is at least disclosed today. **The pagination footer's "X of Y" text is not disclosed anywhere and is factually incorrect whenever true matches exceed 50.** This is the single most concrete, easily-reproduced correctness bug found in this audit (P1 — see §12 for why it's P1 rather than P0).

### Hosted PostgREST row cap — what can and can't be proven from the repo

`supabase/config.toml` declares `[api] max_rows = 1000`. This is the config for the **local** Supabase CLI dev stack; it is *not* proof of the live/hosted project's actual `db.max_rows` setting, which is configured via the Supabase Dashboard/Management API and is not version-controlled. 1000 is Supabase's platform default, and nothing in the repo suggests it was changed, but **this cannot be confirmed from repository code alone** and is reported as **UNVERIFIED**, not assumed.

Practical consequence: Path A (`fetchTransactions`, Dashboard/Reports/Budgets/Analytics) has no *application* limit, but is very likely still implicitly capped at whatever the hosted PostgREST `max_rows` is (probably 1000, unverified). For a personal budget tracker, a user would need roughly 1000+ lifetime transactions before this silently truncates Dashboard/Reports/Budgets math — much less likely to be hit in practice than the Transactions page's explicit, always-active 50-row cap, but still a real, undocumented ceiling worth fixing before it matters (P2, distinct from the P1 pagination bug which is already reachable today with normal usage).

---

## 9. `v_tx_search` — Summary

Already covered fully in §2. Key points restated: `security_invoker = on` (RLS respected, verified from the actual `CREATE VIEW` statement, not inferred); plain `LEFT JOIN` to `categories`; no computed/full-text search column (search is `ilike` on `merchant`/`note` at query time); no server-side total-count support is used by any current caller, which is *why* the pagination bug in §7 exists — even if the frontend wanted a real total, the query never asks PostgREST for one (`{ count: 'exact' }` is never passed).

---

## 10. Dashboard Data Correctness

| Widget | Source | Notes |
|---|---|---|
| Income This Month | Client-side, `computeDashboardSummary` over `fetchTransactions` result | Period-correct (calendar month, browser-local tz — see §18) |
| Expenses This Month | Same | Same |
| Net Cash Flow This Month | Same (derived) | Same |
| Budget Warnings | Client-side, `useBudgetsForPeriod` (per-budget spend from the same transaction set) | Period-correct |
| Cashflow chart | Client-side, same transaction set bucketed by day/week | Same |
| Spending breakdown | Client-side | Same |
| Recent activity | Client-side, sliced from the same transaction set | Same |
| Budget snapshot | Client-side, same as Budget Warnings | Same |

**None of these call `sum_income_amount`/`sum_expense_amount`/`sum_category_amount` anymore.** A hook that does (`useTotals.ts`) still exists in the codebase but is **completely orphaned** — grep confirms zero import sites outside its own file. The historical "Dashboard totals are all-time" bug is **FIXED at the call-site level**: the all-time RPCs are simply not used by anything the user sees. The RPCs themselves still exist in the database as dead surface (see §13).

**Row-truncation risk:** every widget above is only as correct as the full `fetchTransactions` result. Per §8, this is unbounded in application code but implicitly subject to the (unverified, probably 1000) hosted row cap — so all Dashboard numbers would silently become wrong (undercounting) only once a user's lifetime transaction count exceeds that cap. Not reachable in normal current usage; worth fixing proactively rather than reactively (P2).

---

## 11. Reports Data Correctness

`useReportsData.ts` also consumes the same unbounded `useTransactions(userId)` result (Path A) — **not** the 50-row-capped `transactionsWithFilters`. Period filtering, income/expense sums, monthly buckets, category totals, budget-performance comparisons, and previous-period comparisons are all computed client-side against that one result set. CSV export on the Transactions page uses the *filtered* (50-capped) path, but Reports' own metrics do not go through that path at all.

**Conclusion:** Reports is **not** affected by the 50-row Transactions-page pagination bug. It is affected by the same theoretical (unverified, ~1000-row) hosted cap as Dashboard and Budgets, for the same reason (same underlying query). No report metric is currently wrong in ordinary use; the risk is identical to §10 and should be fixed in the same pass (P2).

---

## 12. Budget Data Correctness

`sum_category_amount(uid, cat_id)` is all-time with no period argument, exactly as historically documented. **It is no longer used to render budget progress anywhere** — grep confirms `getSpentAmount`/`useSpentAmount` (the only call sites) are orphaned, same as `useTotals`. Real budget progress comes from `computeBudgetProgress` (`src/lib/budgetMath.ts`), which filters the full `fetchTransactions` result to the budget's own `category_id` + `month`/`year` before summing. This is period-correct and confirmed by the code's own doc comments, not just an assumption.

**Conclusion:** "Budget category spending being all-time" is **FIXED** at the call-site level, same pattern as Dashboard. Same §8 row-truncation caveat applies (P2, not currently reachable, worth pre-empting).

One separate, newly-observed correctness issue: `profiles.budget_reset_cycle` defaults to the literal string `'month'` at the database level, but the Profile page's `<Select>` only recognizes `weekly | monthly | quarterly | yearly`. A brand-new user (whose profile row is created by the `handle_new_user` trigger, which does not set this column, so it takes the column default) will have `budget_reset_cycle = "month"` — a value Profile's dropdown does not match against any option. This is a genuine, currently-live data/UI mismatch for every new signup until they explicitly change and save that field once (P1 — see §38).

---

## 13. RPC Inventory

| RPC | Signature | Security | Uses `auth.uid()` internally? | Frontend call sites today | Status |
|---|---|---|---|---|---|
| `delete_user_everything` | `(p_user_id uuid) → void` | **SECURITY DEFINER** | **No** — trusts `p_user_id` directly | `delete-user` Edge Function only (via service-role client) | **See §14 — critical finding** |
| `handle_new_user` | trigger, no args | SECURITY DEFINER | N/A (trigger context, reads `NEW`) | Not RPC-callable; fires on `auth.users` INSERT | Fine as-is |
| `is_valid_tz` | `(tz text) → boolean` | INVOKER (default) | N/A — reads `pg_timezone_names`, not user data | Not called from any current frontend code (only used as a CHECK constraint) | Harmless, unused by frontend |
| `sum_category_amount` | `(uid uuid, cat_id int) → numeric` | INVOKER (default) | No — trusts `uid` param | **Orphaned** (`getSpentAmount`/`useSpentAmount` defined, never imported) | Dead code from frontend's view; RLS still protects it (see §14) |
| `sum_expense_amount` | `(uid uuid) → numeric` | INVOKER (default) | No — trusts `uid` param | **Orphaned** (`useTotals`, never imported) | Same |
| `sum_income_amount` | `(uid uuid) → numeric` | INVOKER (default) | No — trusts `uid` param | **Orphaned** (`useTotals`, never imported) | Same |

---

## 14. `auth.uid()` / Client-Supplied-Identity Security Audit — the critical finding

The historical audit flagged "caller-supplied uid" on all data RPCs as a security concern but could not verify exploitability (no migrations existed at the time). With the real SQL now available, the actual risk splits into two very different categories:

### Not exploitable: `sum_category_amount` / `sum_expense_amount` / `sum_income_amount`
None of these declare `SECURITY DEFINER` (they default to `SECURITY INVOKER`), and RLS is enabled on `transactions`/`categories` with correct owner-scoped policies. When called as an authenticated user with someone else's `uid`, Postgres still applies the RLS `USING (auth.uid() = user_id)` clause on top of the function's own `WHERE user_id = uid`. Both conditions can only be simultaneously true if `uid = auth.uid()`, so passing another user's id returns `0` (via `coalesce`), never their data. **The client-supplied-uid pattern here is bad practice (should derive identity internally rather than trust a parameter) but is not currently exploitable.** Reclassified from the historical "High — S2" to **P3** (code-quality / defense-in-depth cleanup), given the functions are also dead code today (§13).

### Exploitable — CRITICAL: `delete_user_everything`
This function **is** `SECURITY DEFINER` (runs as the function owner, `postgres`, which **bypasses RLS entirely**), and it trusts `p_user_id` with **no internal check that it matches `auth.uid()`**. Critically, the migration's own grant statements give **execute permission to `anon` and `authenticated`**, not just `service_role`:
```sql
REVOKE ALL ON FUNCTION public.delete_user_everything(uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_user_everything(uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_user_everything(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_user_everything(uuid) TO service_role;
```
This means **any unauthenticated visitor holding only the public anon key** (which ships in every client bundle by design) **can call this RPC directly from a browser console** —
```js
supabase.rpc('delete_user_everything', { p_user_id: '<any-victim-uuid>' })
```
— and it will permanently delete that victim's `transactions`, `budgets`, `categories`, and `profiles` row, with **no ownership check whatsoever**, because SECURITY DEFINER means RLS never gets a chance to stop it. The real, safe `delete-user` Edge Function happens to call this RPC only after its own JWT-and-id check, but **that check lives entirely in application code the RPC itself knows nothing about** — the RPC is directly reachable via PostgREST regardless of the Edge Function's existence.

This is the single most severe finding in this audit: **P0, cross-user destructive data loss, reachable without authentication.** It does not delete the victim's actual `auth.users` row (that part is `admin.auth.admin.deleteUser`, correctly restricted to the Edge Function's service-role client), so the attack is "wipe someone's financial data while leaving their empty account behind" rather than full account takeover — still unambiguously critical.

---

## 15. RLS Findings by Table

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | own row only (`auth.uid() = id`) | own row only (`auth.uid() = id`) | own row only | own row only |
| `categories` | own rows **or** global (`user_id IS NULL`) | own rows only (`auth.uid() = user_id`) | own rows only | own rows only |
| `transactions` | own rows only | own rows only | own rows only | own rows only |
| `budgets` | own rows only | own rows only | own rows only | own rows only |

**Can a user read/insert/update/delete another user's rows via normal REST access?** No, for all four tables — every policy correctly scopes to `auth.uid()`. Global categories are correctly read-only to everyone except their (non-existent, `user_id IS NULL`) owner — no policy allows `UPDATE`/`DELETE` on rows where `user_id IS NULL`, since those policies all require `auth.uid() = user_id`, which can never equal `NULL`. **The one and only way to bypass this entire correctly-configured RLS setup is the `delete_user_everything` SECURITY DEFINER grant in §14** — RLS itself is not the problem; a single over-permissioned function undermines it for DELETE specifically.

---

## 16. Storage Findings

- Bucket: `avatars`. Referenced URLs use the `/storage/v1/object/public/avatars/...` path format (confirmed from the Edge Function's own `pathFromPublicUrl` parser and `useAvatar.ts`'s duplicate of the same logic), which is strong in-repo evidence the bucket is configured **public** — public buckets serve reads to anyone with the URL, bypassing `storage.objects` RLS for SELECT entirely. This cannot be verified with 100% certainty from migrations alone (bucket-level public/private flags aren't always captured as SQL), but the URL scheme in active use is decisive evidence, not a guess.
- 4 `storage.objects` policies (INSERT/SELECT/UPDATE/DELETE, all `to authenticated`), each requiring `name LIKE (auth.uid() || '%')` — i.e. the object path must be prefixed with the uploader's own UUID. This correctly prevents one authenticated user from writing to another's object path via the authenticated API surface.
- Because the bucket is public, the object-path RLS above only matters for **writes** (upload/replace/delete) — **reads bypass it entirely** by design of a public bucket. Anyone with a leaked/guessed avatar URL can view it. Avatars are low-sensitivity (a photo the user chose to upload for their own profile), paths are UUID-prefixed (not practically guessable), and there's no other user-facing surface that lists other users' avatar URLs — so this is **informational, P3**, not a vulnerability, but worth a conscious sign-off rather than silent assumption.
- Old avatar files are **not** cleaned up on replace — `useUploadAvatar` overwrites the `profiles.avatar_url` column but never deletes the previous Storage object, so re-uploading repeatedly accumulates orphaned files under the user's own prefix. Confirmed still present (P3, storage cost/hygiene only, not a security issue since it's still scoped to the same user's own prefix).
- Delete-account avatar cleanup **does** correctly remove the current avatar object (Edge Function step 3, best-effort, wrapped so storage failures don't block the rest of deletion) — but note this only removes the *current* `avatar_url`, not any orphaned prior uploads from the point above.

---

## 17. Edge Function Findings (`delete-user`, the only Edge Function)

| Item | Status |
|---|---|
| JWT verification | ✅ Correct — user-scoped client built from the caller's own `Authorization` header, `getUser()` called to verify |
| Ownership check | ✅ Correct — `authData.user.id !== userId` → 403, before any destructive step |
| CORS | ❌ **Still `Access-Control-Allow-Origin: "*"`** on every response, including the destructive success/error paths — unchanged from the historical finding (P2 — credentialed but JWT-protected, so wildcard CORS doesn't itself grant unauthorized access, but it is bad practice on a destructive endpoint and should be restricted to known origins) |
| Rate limiting | ❌ None — unchanged |
| Raw error leakage | ❌ Still present — `rpcErr.message` and `delErr.message` are returned verbatim to the client on failure (lines 79, 88); the final `catch` also returns `String(e?.message ?? e)` raw. Unchanged from the historical finding (P2 — leaks schema/constraint detail, though only to the already-authenticated account owner, not an arbitrary attacker) |
| Input validation | Minimal — only checks `userId` is present, not its shape (not a real risk since it's immediately compared against the verified JWT's own id) |
| Service-role usage | ✅ Correctly scoped — only the admin client (service role) performs the RPC call, storage delete, and `auth.admin.deleteUser`; the initial verification uses only the anon-keyed, JWT-scoped client |
| Dependency pinning | ❌ `https://esm.sh/@supabase/supabase-js@2` is not pinned to an exact version — unchanged |
| Logging | None beyond default Deno/Supabase function logs; no financial data is logged, which is good |
| Order of operations | Storage → RPC (transactions/budgets/categories/profiles) → `auth.admin.deleteUser` — correct, and now doubly safe given §4's confirmed FK cascades |

---

## 18. Auth Backend Findings

- **Signup trigger**: `handle_new_user()` on `auth.users AFTER INSERT`, `SECURITY DEFINER`, inserts a `profiles` row with `full_name = coalesce(raw_user_meta_data->>'full_name', '')`, `on conflict (id) do nothing`. Confirmed real and matches the `signUp()` call's `options.data.full_name` metadata exactly — full_name flows through correctly.
- **Profile-creation race**: the trigger runs `AFTER INSERT` on `auth.users`, synchronously as part of the same transaction as the auth user's creation (standard Postgres trigger semantics) — there is no window where a signed-up user could hit `AuthGate`/`useProfile` before their `profiles` row exists, other than the ordinary email-confirmation gap (during which they aren't authenticated yet anyway).
- **Email verification**: link-based (Supabase default `signUp` confirmation flow), not OTP. `VerifyEmail.tsx` correctly detects success via `onAuthStateChange("SIGNED_IN")` + a `getSession()` fallback, matching how Supabase's implicit-flow client actually behaves when a confirmation link is opened.
- **Password reset**: `resetPasswordForEmail(email, { redirectTo: origin + "/reset-password" })`, and `ResetPassword.tsx` correctly detects the resulting recovery session via `onAuthStateChange("PASSWORD_RECOVERY")` + `getSession()` fallback + a 1200ms grace timeout before declaring the link invalid. This is a reasonable, defensible way to handle Supabase's implicit-flow recovery session without any custom backend code.
- **Redirect URLs**: both built from `window.location.origin` at call time — correct for any deployment origin without hardcoding, though this does mean Supabase's Auth dashboard must have the deployed origin(s) allow-listed under "Redirect URLs" for the links to work in production (cannot be verified from repo — dashboard config, out of scope for a code audit, flagged as **UNVERIFIED**).
- **`AuthGate`**: no `onAuthStateChange` subscription — relies on `useUser()` (react-query, `staleTime` 5 minutes per earlier project work). A session revoked mid-use (e.g. from another device, or manually in the Supabase dashboard) would not be proactively detected; the user would see scattered query failures on next data fetch rather than a clean redirect to Sign In. This is the historical "B11" finding — **still present**, low severity for a personal single-user app, worth a P3 follow-up (a single app-wide `onAuthStateChange` listener that clears the query cache and redirects on `SIGNED_OUT`).
- **Sign Out**: `useSignOut()` calls `supabase.auth.signOut()`, clears the query cache, and navigates to `/`. The historical "Sign Out does not sign out" finding (a `<Link to="/">` with no real signOut call) is **FIXED** — confirmed real and already wired into both the desktop `ProfileMenu` and `MobileProfileMenu`.
- `supabaseClient.ts` passes no explicit `auth` options to `createClient`, which means it runs on supabase-js v2's browser defaults: `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`. These defaults are exactly what the Reset Password / Email Verification implicit-flow logic depends on — no gap here, just worth stating explicitly since it's implicit rather than declared.

---

## 19. Settings / Profile Backend Gaps

Real, currently-persisted `profiles` columns: `full_name`, `avatar_url`, `budget_reset_cycle`, `reset_day`, `timezone`. Nothing else exists on the table.

| Frontend field | Where shown | Backend column? | Status |
|---|---|---|---|
| Full name | Profile (editable) | `full_name` | Real |
| Avatar | Profile (editable) | `avatar_url` + Storage | Real |
| Email | Profile (read-only), Account | `auth.users.email` (not `profiles`) | Real, correct read-only |
| Phone | Profile | — | Frontend-ready only, disabled, "Coming soon" |
| Location | Profile | — | Frontend-ready only, disabled |
| Financial bio | Profile | — | Frontend-ready only, disabled |
| Budget reset cycle | Profile (editable) | `budget_reset_cycle` | Real, **but see §12's default-value mismatch** |
| Reset day | Profile (editable) | `reset_day` | Real, no DB-level range CHECK |
| Timezone | Profile (read-only display) / Settings (editable) | `timezone` | Real, persisted, but **never read by any date/period calculation** (§18/§25) |
| Preferred currency | Settings | — | Frontend-ready only, disabled, fixed at "USD ($)" |
| Date format | Settings | — | Frontend-ready only, disabled |
| Number format | Settings | — | Frontend-ready only, disabled |
| Appearance/theme | Settings | — | Static "Nexali Obsidian Dark" display only, dark-only v1 by product decision, not a gap |
| Notification preferences | Settings | — | Frontend-ready only, disabled (see §20) |

**Recommended future schema direction** (not implemented in this Part):
- **Profile data** (identity/contact): `phone text`, `location text`, `financial_bio text` on `profiles` — simple additive columns, no new table needed.
- **Application settings** (formatting/regional): `currency text default 'USD'`, `date_format text`, `number_format text` — likely also belongs on `profiles` (one row per user, same cardinality as existing preference columns) rather than a new table, unless a future "multiple named preference sets" feature is planned.
- **Notification settings**: a distinct concern from the above two — see §20 for why a separate table is the right shape.

---

## 20. Notifications Backend Gaps

Confirmed: **zero** backend exists. No `notifications` table, no `notification_preferences` table/columns, no RPC, no Edge Function. The Notifications frontend (Part 11) intentionally renders a real, permanently-empty local array and a truthful empty state — this remains accurate; nothing regressed it.

Future requirements, for later scoping (not built now):
- `notifications` table: `id`, `user_id` (FK, cascade), `type`, `title`, `description`, `created_at`, `read boolean default false`, `read_at`, optional `action_href`/`action_label`. RLS: owner-only SELECT/UPDATE(mark read)/DELETE(dismiss); INSERT likely server-side only (via trigger or Edge Function, not client INSERT, since notifications should be system-generated, not user-authored).
- Unread count: either a lightweight `SELECT count(*) WHERE read = false` (fine at personal-app scale) or a maintained counter if this ever needs to scale.
- Mark read / mark all read / dismiss: straightforward owner-scoped UPDATE/DELETE, RLS-protected the same way every other table already is.
- Notification preferences: cleanest as a **separate** `notification_preferences` table (or a single JSON/boolean-columns row per user) rather than folding into `profiles`, since it's a different concern (what to be notified about) from account/regional settings, and is more likely to grow additional rows/columns independently over time (per-category toggles, per-channel toggles, etc.).
- Indexes: `notifications(user_id, created_at desc)` and `notifications(user_id, read)` for the unread-count/list queries.

---

## 21. Aura Backend — Current Status

**Nothing exists.** No Edge Function, no AI provider integration, no tool layer, no model calls, no server-side prompts — confirmed by a full-repo grep for any AI-provider name, any non-Supabase API key pattern, and any `ai-*` function directory. The Aura *frontend* is a complete, honest, read-only presentation layer with no fabricated backend claims (consistent with the Part 6 frontend work).

`docs/MASTER_SPEC.md` still describes the intended first-version architecture, and nothing found in this audit contradicts it:
```
React
  → authenticated Supabase Edge Function
    → auth/input validation (verify JWT, derive user id from the token — never trust a client-supplied id)
      → deterministic, auth.uid()-scoped, timezone-aware, period-aware read-only SQL tools
        → model call (provider key lives only in Edge Function env vars, never VITE_-prefixed, never in the browser)
          → validated, schema-checked response back to the client
```
This audit's most relevant precondition for that later work: the current all-time, caller-supplied-uid RPCs (§13/§14) are exactly the pattern the spec says must not be reused for Aura's tools — any real Aura tool layer needs new, period-aware, `auth.uid()`-internal SQL functions, not the existing three sum functions.

---

## 22. Generated Types vs. Migrations — Drift Check

No drift found. `src/types/database.types.ts` matches the migration-derived schema exactly for all 4 tables, the view, and all 5 functions (column names, nullability, and function signatures all cross-checked line-by-line). This is expected, since the types file is generated from the same live database that `migration list` confirms is in sync with the repo's migration history.

One pre-existing type-accuracy issue, unrelated to drift between file and DB: `src/lib/budgets.ts`'s `Budget` type claims `categories: Pick<CategoryRow, "id"|"name"|"type">`, but `getBudgets()`'s actual `.select()` only fetches `id, name` — `type` is never selected. Confirmed **harmless today**: grep shows nothing ever reads `.categories.type` off a `Budget` object (only off `TransactionWithCat`, which *does* select `type` correctly). This is the historical "B4" finding — still present as a type inaccuracy, downgraded from its original "Medium impact" since the code path that would have made it a live bug no longer exists (P3).

---

## 23. Migration History

| Migration | Timestamp | Purpose | Superseded? |
|---|---|---|---|
| `20260910235021_remote_schema.sql` | 2026-09-10 23:50:21 | Baseline: all 4 tables, `v_tx_search`, all 5 functions, all RLS policies, all grants, the `handle_new_user` trigger, all 4 Storage policies. This is a `supabase db pull`-style full-schema snapshot, not a hand-written incremental migration. | Partially — `profiles_id_fkey` from this file is superseded by the next migration |
| `20260910235733_fix_profiles_user_delete_cascade.sql` | 2026-09-10 23:57:33 | Drops and recreates `profiles_id_fkey` with `ON DELETE CASCADE` | No |

No contradictory migrations. Both confirmed deployed (§4). The 712-second gap between the two timestamps is consistent with the cascade fix being written and applied shortly after the initial schema pull, in the same session.

---

## 24. Index / Performance Audit

Existing indexes (from the baseline migration): primary keys on all 4 tables (btree on `id`), the 4 (partially redundant) `categories` unique indexes, and the `budgets` unique constraint index. **No other indexes exist.**

Likely-missed indexes for current access patterns:
- `transactions(user_id, created_at desc)` — every transaction query (both `fetchTransactions` and `transactionsWithFilters`) filters by `user_id` and orders by `created_at`. Currently only the implicit index from `transactions_user_id_fkey`'s FK (Postgres does *not* automatically index FK columns, so even that isn't guaranteed — worth confirming, not assumed) plus a full sort. At current data volumes this is invisible; will matter once per-user transaction counts grow into the thousands.
- `transactions(user_id, category_id)` — used by the (now-dead) `sum_category_amount` and by client-side per-category filtering; low priority given the RPC is unused, but the client-side filter still scans the full fetched set (in-memory, not a DB concern) so this is lower priority than the one above.
- `budgets(user_id, year, month)` — used by `useBudgetsForPeriod`'s period filter; covered partially by the existing unique index on `(user_id, category_id, month, year)` but a plain `(user_id, year, month)` index (without `category_id`) would serve the "all budgets for this period" query more directly.
- `categories(user_id)` — light traffic, low priority.
- `profiles(id)` — already the primary key, no action needed.

None of these are urgent at today's data volume; flagged as P2/P3 groundwork for the transaction-query-architecture and aggregate-correctness work (Backend Parts 3–4).

---

## 25. Data Integrity Audit

| Area | DB-level enforcement | Frontend enforcement | Gap |
|---|---|---|---|
| Transaction amount | CHECK `> 0` | `validateAmount`: finite, `>0`, `<=999999999` | Frontend is stricter (upper bound); DB has no upper bound — a direct API call could insert an absurdly large amount. Low risk (numeric(10,2) itself caps magnitude to ~99999999.99). |
| Transaction type | Not a column — derived from `categories.type` | Enforced at category-resolution time (`resolveCategoryId`) | Consistent; type "belongs" to the category, not the transaction, by design |
| Budget amount | CHECK `> 0` | Frontend requires `>0` | Consistent |
| Budget month/year | CHECK `1–12` on month; **no CHECK on year at all** | Frontend restricts year to a sane UI range (per Budgets form) | DB would accept `year: -5` or `year: 99999` via direct API access; frontend-only guard |
| Category uniqueness | Real, DB-enforced (see §2's 4 indexes, one of which does real case-insensitive work) | `resolveCategoryId`/`upsertCategory` also check before insert | Consistent, arguably over-enforced (redundant indexes, §2) |
| Budget uniqueness | Real, DB-enforced UNIQUE `(user_id, category_id, month, year)` | `isDuplicateBudgetError` maps the resulting `23505` to a friendly message | Consistent; NULL-category edge case noted in §2, unresolved |
| Timezone validation | Real, DB-enforced CHECK via `is_valid_tz` | Settings only offers 6 known-valid IANA names (plus the currently-stored value as a synthetic extra option) | Consistent, DB is the actual backstop |
| Profile defaults | `budget_reset_cycle` default `'month'` doesn't match any frontend-recognized value (see §12) | — | **Real mismatch, P1** |
| `reset_day` range | **No CHECK** (frontend caps 1–31 only) | `<input type=number min=1 max=31>` | DB would accept `reset_day: 0` or `999` via direct API access |

---

## 26–27. Frontend Untouched / Audit-Only Confirmation

No frontend page, component, route, or visual behavior was modified in this Part. The only files touched are this report and (implicitly) none of the production `src/` tree. No migrations were applied, no destructive SQL was run, no `supabase db reset` or equivalent was executed. The one live-database interaction was the explicitly-permitted read-only `supabase migration list` command (§4), which changes nothing.

---

## 28. Historical Audit Items — Reconciled Against Current Code

| # | Historical finding (`docs/AUDIT_REPORT.md`, 2026-07-29) | Current status |
|---|---|---|
| B1 | Sign Out doesn't sign out | **FIXED** — real `useSignOut()`, confirmed wired into both menus |
| B2 | Conditional hook call in `BudgetCard` | **FIXED** (per that doc's own note; re-confirmed `BudgetCard.tsx` has no early-return-before-hooks pattern today) |
| B3 | Single-date filter always zero rows | **NO LONGER RELEVANT AS DESCRIBED** — a full re-verification of the exact date-filter boundary logic was out of scope for this backend-only audit; flagged **UNVERIFIED**, recommend a quick frontend regression check in Backend Part 3 alongside the transaction-date work |
| B4 | `budget.categories.type` always undefined | **STILL PRESENT as a type inaccuracy, but harmless** — nothing reads it (§22) |
| B5 | Dead query invalidation key mismatch | **UNVERIFIED** — not re-traced in this pass; `invalidateRelatedQueries` in current `useTransactions.ts` invalidates `txRoot`/`totals`/`spentRoot`, which look consistent with current query keys, but budget-specific invalidation wasn't independently re-audited here |
| B6 | Pagination wrong past 50 rows | **STILL PRESENT — confirmed with exact mechanism and quantified examples**, see §7. This is P1. |
| B7 | String id injected into numeric `TxId` field | **STILL PRESENT** — `transactionsWithFilters`'s `id: row.id || \`temp-${Date.now()}\`` fallback is unchanged in current `src/lib/transactions.ts`. Low real-world impact (`row.id` from a real DB row is never falsy), but the type hole is real. P3. |
| B8 | Avatar re-fetches every render | **STILL PRESENT** — `useAvatar`'s `select: (url) => url ? \`${url}?v=${Date.now()}\` : null` recomputes a new string on every access. P3, performance-only. |
| B9/B10 | `text-success` missing / `rounded-x1` typo | **OBSOLETE** — both were artifacts of the pre-Lovable-redesign CSS, which no longer exists; `success` is now a real, defined theme token used throughout the current design system |
| B11 | No `onAuthStateChange`, no expired-session handling | **PARTIALLY FIXED** — `ResetPassword`/`VerifyEmail` now use `onAuthStateChange` locally for recovery/verification detection; there is still no app-wide subscription for session-revocation handling in `AuthGate`. P3. |
| B12 | Mixed dialog-opening mechanisms | **OBSOLETE** — the entire dialog system was rebuilt on Radix `Dialog` during the Lovable redesign; no `showModal()`/`getElementById` pattern remains |
| P1 (old) | Dashboard totals all-time | **FIXED** — client-side period math, all-time RPCs orphaned (§10) |
| P2 (old) | Budget spend all-time | **FIXED** — same pattern (§12) |
| P3 (old) | Budgets from all periods listed together, no period nav | **UNVERIFIED** — not re-traced against the current (redesigned) Budgets page in this backend-only pass |
| P4 (old) | Timezone stored but never used | **STILL PRESENT — confirmed**, see §18/§25. Now doubly notable since Settings can genuinely persist it (Part 10) but it still has zero calculation effect. |
| P5 (old) | Currency hardcoded to USD | **STILL PRESENT** — `formatCurrency` defaults to `"USD"`; no persisted currency column exists to read from (§19) |
| P6 (old) | Transaction date not user-selectable | **STILL PRESENT — confirmed**, see §5 |
| S1 (old) | Sign Out security gap | **FIXED**, same as B1 |
| S2 (old) | Caller-supplied RPC identity | **RECLASSIFIED** — the 3 `sum_*` functions are not exploitable (RLS still applies, §14) and are dead code; `delete_user_everything` **is** exploitable and is now the **P0** of this entire audit, for a different, more severe reason (SECURITY DEFINER + public grants) than originally suspected |
| S3 (old) | RLS/Storage/view policies unverifiable (no migrations) | **RESOLVED as an unknown** — migrations now exist and were read directly; RLS confirmed correct on all 4 tables (§15), Storage policies confirmed (§16), view confirmed `security_invoker` (§9) |
| S4 (old) | `.or()` string interpolation in `categories.ts` | **STILL PRESENT**, confirmed in both `getExpenseCategories` and `listCategoriesAll`. `userId` still comes only from the verified session context, so still not currently exploitable. P3. |
| S5 (old) | Wildcard CORS on `delete-user` | **STILL PRESENT**, confirmed (§17) |
| S6 (old) | No rate limiting; `userId` from body | **STILL PRESENT** re: rate limiting; the body `userId` is (and always was) safely cross-checked against the verified JWT, so this half of the original finding was already accurately scoped as low-risk |
| S7 (old) | Raw DB errors returned | **STILL PRESENT**, confirmed (§17) |
| S8 (old) | Avatars in public bucket | **STILL PRESENT, reconfirmed as informational/acceptable** (§16) |
| S9 (old) | `SERVICE_ROLE_KEY` in `supabase/.env`, gitignored | **UNVERIFIED in this pass** — not re-checked; no reason to believe it changed |
| S10 (old) | No `.env.example` | **UNVERIFIED / likely still true** — not the focus of this audit |
| S11 (old) | `window.confirm`/`alert` for destructive actions | **FIXED** — the entire redesign replaced these with real `Dialog`-based confirmations (`ConfirmDialog`, `DeleteAccountDialog`), including the typed "DELETE" confirmation built in Part 9 |

---

## 29. Findings by Priority

### P0 — Critical
- **P0-1**: `delete_user_everything(uuid)` is `SECURITY DEFINER`, has no internal `auth.uid()` check, and is granted to `anon`/`authenticated`. Any unauthenticated party with the public anon key can permanently delete **any other user's** `transactions`, `budgets`, `categories`, and `profiles` row by calling the RPC directly, bypassing RLS entirely. (§14)

### P1 — High
- **P1-1**: Transactions-page pagination footer and CSV export both read "total" from a server response artificially capped at 50 rows (`transactionsWithFilters`'s `.range()` default, never advanced, no `count: 'exact'`). Any filter matching more than 50 rows shows a wrong total and permanently hides the remainder. (§7)
- **P1-2**: `profiles.budget_reset_cycle`'s database default (`'month'`) does not match any value the frontend's `<Select>` recognizes (`weekly/monthly/quarterly/yearly`), so every newly-signed-up user has a mismatched value until they manually change and save it once. (§12, §25)
- **P1-3** *(carried forward, reclassified as still real)*: No dedicated transaction date column — `created_at` (row-insertion time) is used everywhere as the financial date, with no way to backdate. (§5)

### P2 — Medium
- **P2-1**: `fetchTransactions()` (Dashboard/Reports/Budgets/Analytics) has no application-level limit and is implicitly bounded only by the hosted PostgREST row cap (probably 1000, unverified). Silent under-counting once a user's lifetime transaction count exceeds that cap. (§8, §10, §11, §12)
- **P2-2**: `profiles.timezone` is real and persisted but read by zero date/period calculations anywhere in the app; all "this month" math uses the browser's local timezone. (§18, §25)
- **P2-3**: `delete-user` Edge Function: wildcard CORS, raw error-message passthrough to the client, no rate limiting, unpinned `esm.sh` dependency version. (§17)
- **P2-4**: Missing indexes for current access patterns, most notably `transactions(user_id, created_at desc)`. Not urgent at current data volume. (§24)
- **P2-5**: Settings/Profile backend gap — no `currency`, `date_format`, `number_format`, `phone`, `location`, `financial_bio` columns exist; corresponding frontend controls are correctly disabled/read-only rather than lying, but the schema work to unlock them hasn't happened. (§19)
- **P2-6**: Notifications has zero backend (by design so far, not a regression) — will need a real schema before Backend Part 6. (§20)
- **P2-7**: `budgets.year` has no CHECK constraint at all; `profiles.reset_day` has no CHECK for its intended 1–31 range. Both rely entirely on frontend validation. (§25)

### P3 — Low
- **P3-1**: `sum_category_amount`/`sum_expense_amount`/`sum_income_amount` are dead code from the frontend's perspective (still callable, still all-time, but not currently a live data-correctness issue since nothing calls them) — candidates for removal once Backend Part 4 replaces them with real period-aware, `auth.uid()`-internal functions. (§13, §14)
- **P3-2**: `useAvatar`'s cache-busting `select` recomputes a new URL string on every access, causing avatar image re-fetches more often than necessary. (§28, historical B8)
- **P3-3**: `.or()` string-built filters in `categories.ts` — not currently exploitable (input is always the verified session's own uid), but a fragile pattern that should move to composed `.eq()`/`.is()` filters. (§28, historical S4)
- **P3-4**: Four overlapping/redundant unique indexes on `categories` — functional but confusing, worth consolidating to the one that actually does the case-insensitive work. (§2, §24)
- **P3-5**: `Budget.categories` type claims a `type` field the query never selects — harmless today (nothing reads it) but should be corrected for type honesty. (§22, historical B4)
- **P3-6**: No app-wide `onAuthStateChange` subscription for session-revocation handling; a revoked/expired session surfaces as scattered query failures rather than a clean redirect. (§18, historical B11)
- **P3-7**: Old avatar Storage objects are never cleaned up on replace, only on explicit delete — orphaned files accumulate under the user's own prefix over time. (§16)
- **P3-8**: `transactions.ts`'s fallback `id: row.id || \`temp-${Date.now()}\`` injects a string where `TxId` is typed `number`. Not observed to manifest in practice (a real row's `id` is never falsy). (§28, historical B7)
- **P3-9**: `profiles.created_at` is `timestamp without time zone` while `transactions.created_at`/`budgets.created_at`/`categories.created_at` mix `with`/`without` time zone inconsistently — worth normalizing whenever these columns are next touched, not urgent on its own.

---

## 30. Recommended Backend Part 2

Given the actual findings above (not the originally-guessed template), **Backend Part 2 should be scoped narrowly to the P0 and the two most-reachable P1s**, since they are independent of each other and independently high-value:

**Backend Part 2 — Critical Security + Deletion/Pagination Correctness**
1. Fix `delete_user_everything`: either (a) drop `SECURITY DEFINER` and add an explicit `auth.uid() = p_user_id` guard so RLS still applies and a mismatched caller gets nothing, or (b) keep `SECURITY DEFINER` but add `IF auth.uid() <> p_user_id THEN RAISE EXCEPTION ...` as the function's first statement, **and** in either case `REVOKE` execute from `anon`/`authenticated` and grant only to `service_role` (the Edge Function is the only legitimate caller). This is the P0 and should ship alone if timeline pressure demands splitting further.
2. Fix the Transactions-page pagination: add `{ count: 'exact' }` to `transactionsWithFilters`'s query, thread the real total through to `TransactionTable`'s footer, and either wire the "rows per page" control to real server-side `.range()` pagination or clearly cap/paginate server-side with a real "load more" affordance instead of the current always-first-50 behavior.
3. Fix `profiles.budget_reset_cycle`'s default (either change the column default to `'monthly'` to match the frontend, or make `handle_new_user` set it explicitly) — small, low-risk, high-value correctness fix.
4. While in the RPC/RLS layer anyway: harden `delete-user`'s CORS (restrict to real deployed origins) and stop returning raw `error.message` to the client (map to safe messages the same way `normalizeAuthError` already does on the frontend).

This groups "things that are actually dangerous or actively wrong today" into one reviewable, testable Part, independent of the larger schema-design work (transaction dates, Settings columns, Notifications, Aura) that follows.

## 31. Recommended Full Backend Sequence

1. **Backend Part 2** — as above: critical RPC security fix, pagination/count fix, `budget_reset_cycle` default fix, Edge Function hardening. (P0 + reachable P1s)
2. **Backend Part 3** — Transaction date architecture: add a real `occurred_at` (or similar) column, decide backfill strategy for existing rows (likely `occurred_at = created_at` for all historical rows), update insert/edit to accept a user-chosen date, and repoint Dashboard/Reports/Transactions/Budgets filtering and sorting from `created_at` to the new column without changing their client-side math (which is already correct, just pointed at the wrong field).
3. **Backend Part 4** — Server-side aggregate correctness + row-cap elimination: replace `sum_income_amount`/`sum_expense_amount`/`sum_category_amount` with real, period-parameterized, `auth.uid()`-internal SQL functions (or keep the math client-side but make `fetchTransactions` genuinely paginate/aggregate server-side) so Dashboard/Reports/Budgets stop depending on an unbounded client-side fetch at all. Add the indexes identified in §24 alongside this, since the same queries benefit from both changes together.
4. **Backend Part 5** — Profile + Settings schema completion: add `phone`, `location`, `financial_bio` to `profiles`; decide table shape for `currency`/`date_format`/`number_format` (recommend: same `profiles` row, per §19); wire the already-built frontend controls to real persistence; and actually apply `profiles.timezone` to date/period math (closing P2-2) as part of this same pass since it's the same "profile preferences become real" theme.
5. **Backend Part 6** — Notifications backend: `notifications` + `notification_preferences` tables, RLS, indexes, mark-read/mark-all-read/dismiss, wired to the already-built frontend components from Part 11.
6. **Backend Part 7** — Aura backend v1 (read-only): the Edge Function + tool layer described in §21, built on top of the period-aware/timezone-aware functions from Backend Part 3–4 (not the old all-time RPCs).
7. **Backend Part 8** — Final hardening pass: the remaining P2/P3 items not folded into earlier parts (avatar cleanup-on-replace, `.or()` filter cleanup, `onAuthStateChange` app-wide session handling, dead-RPC removal, CHECK constraints on `budgets.year`/`profiles.reset_day`, index consolidation on `categories`, `created_at` timezone-type consistency).

This sequence is ordered by (a) actual severity found, (b) dependency order (transaction dates must exist before period-aware aggregates can be fully correct; Aura tools depend on both), and (c) grouping same-theme work together (all Profile/Settings persistence in one Part, all Notifications in one Part) rather than the originally-guessed template ordering, which had aggregates before transaction dates — this audit found that transaction-date work should come first since Part 4's server-side aggregates would otherwise need to be rebuilt again once a real date column exists.

---

## 32. Quality Gates (this Part — audit only, no production code changed)

```
npm run test        → 46 files, 369 tests passed
npm run lint         → 0 errors, 0 warnings
npx tsc -b --force   → 0 errors
```
No `npm run build` was needed (no `src/` changes); the above three were run to confirm the repository was left exactly as found.

---

## 33. What This Report Is / Is Not

This is an audit and prioritized roadmap, not a set of applied fixes. Per the governing instructions for this Part: no migrations were applied, no destructive commands were run, no frontend was modified, and no production backend code was changed. The only artifact produced is this file.

---

## 34. Backend Part 2 — Changes Applied (2026-09-13)

Two new forward-only migrations were **created but not applied**:

- `supabase/migrations/20260913000000_secure_delete_user_rpc.sql` — fixes **P0-1**: revokes `EXECUTE` on `delete_user_everything(uuid)` from `anon`/`authenticated`, grants it to `service_role` only, and adds an in-function `auth.role() = 'service_role'` guard as defense-in-depth. Does not change the function's deletion logic (still deletes `transactions`/`budgets`/`categories`/`profiles` for the given id, same order).
- `supabase/migrations/20260913000100_correct_profile_defaults.sql` — fixes **P1-2**: changes `profiles.budget_reset_cycle`'s default from `'month'` to `'monthly'`, plus a narrowly-scoped backfill (`WHERE budget_reset_cycle = 'month'`) for existing rows, justified because `'month'` was never a frontend-selectable value (see §12).

Application code changes (P1-1 and Edge Function hardening, no migration needed):
- `src/lib/transactions.ts`: `transactionsWithFilters` now does real server-side pagination with an exact total count (`{ count: "exact" }` + `.range()`), returning `{ rows, totalCount }` instead of a bare, silently-capped array. Added `fetchAllTransactionsWithFilters` for CSV export (same filters, no page cap).
- `src/features/querykeys.ts`: `normalizeFilters`'s default `limit` changed from `50` (a de facto hard cap) to `10` (a real page size); added `normalizeExportFilters` and `qk.txExport`.
- `src/features/transactions/useTransactions.ts`: added `useExportTransactionsWithFilters`; `useTransactionWithFilters` unchanged in shape but now backed by the real paginated query.
- `src/components/TransactionTable.tsx`: removed the client-side re-slice of an already-capped array; page/pageSize now drive real server `limit`/`offset`; footer and page count now come from the server's real `totalCount`; resets to page 1 when filters change.
- `src/pages/Transactions.tsx`: CSV export now uses `useExportTransactionsWithFilters` (all matching filtered rows) instead of sharing the table's paginated query; tooltip updated to no longer claim a 50-row cap.
- `supabase/functions/delete-user/index.ts`: CORS now allowlist-based (configurable `ALLOWED_ORIGINS` env var + built-in localhost dev origins) instead of `*`; all error responses now return a safe generic message with the real detail logged server-side only; the request body's `userId` is no longer read at all -- the target user is derived solely from the verified JWT (`authData.user.id`), removing the client-supplied destructive identifier entirely; avatar Storage cleanup failures are now logged (still non-blocking).

**Dead/orphaned RPCs, not removed in this Part** (candidates for removal once Backend Part 4 replaces them with real period-aware functions, per §13/§29 P3-1): `sum_income_amount(uuid)`, `sum_expense_amount(uuid)`, `sum_category_amount(uuid, int)`. Confirmed zero frontend call sites (`useTotals`, `getSpentAmount`/`useSpentAmount` are themselves orphaned). Not exploitable (RLS still applies, see §14), left in place per this Part's "minimal, audit-grounded" scope -- removing them is a cleanup task, not a security or correctness fix.

Full detail, exact SQL, and the deployment/verification plan for the two migrations are in the Backend Part 2 completion report (session record); the migration files themselves are the source of truth for what will change once applied.

**Part 2 deployment status (checked at the start of Part 3 via the read-only `npx supabase migration list`): both `20260913000000_secure_delete_user_rpc.sql` and `20260913000100_correct_profile_defaults.sql` are confirmed deployed to the live project** (`local`/`remote` timestamps matched for all four migrations that existed at that point). Backend Part 3 was safe to build on top of them.

---

## 35. Backend Part 3 — Transaction Date Architecture (implemented in repository, NOT yet deployed)

**Status: implementation complete and tested in this repository. The two new migrations below have NOT been applied to the live database -- `transactions.occurred_at` does not exist on the hosted project yet.** Do not assume any of this section is live until `npx supabase migration list` confirms it the same way §4/§34 confirmed prior parts.

### What changed conceptually

`transactions.created_at` was being read everywhere as if it were the transaction's financial date (§5/P1-3). It no longer is. A new column, `occurred_at`, now carries that meaning; `created_at` reverts to being purely a technical/audit timestamp (row-insertion time) that nothing in the application reads for date/period logic anymore.

### Migrations created (NOT applied)

- `supabase/migrations/20260914000000_add_transactions_occurred_at.sql` -- adds `transactions.occurred_at timestamptz`, nullable first; backfills `occurred_at = created_at` for every existing row (the only defensible fallback, since no separate financial date ever existed before); sets `NOT NULL`; adds `transactions_user_id_occurred_at_idx` on `(user_id, occurred_at DESC)`. No `DEFAULT` -- every insert path now supplies it explicitly, so a future insert that omits it fails loudly (NOT NULL violation) rather than silently defaulting to "now" and masking a bug.
- `supabase/migrations/20260914000100_expose_occurred_at_in_v_tx_search.sql` -- `CREATE OR REPLACE VIEW v_tx_search` to add `occurred_at` (appended at the end of the column list, since `CREATE OR REPLACE VIEW` cannot reorder or insert existing columns), keeping `security_invoker='on'` and `created_at` exposed exactly as before.

### Application code changed to use occurred_at

- `src/lib/transactions.ts`: `TransactionWithCat` now includes `occurred_at`; `fetchTransactions` selects and orders by it; `upsertTransaction` takes a required `occurredAt` and writes it on both insert and update (update always resends it, so unrelated edits never blank it toward "now"); `applyTransactionFilters` (shared by the table's paginated query and the export batcher) now filters (`fromISO`/`toISO`) and defaults the "date" sort to `occurred_at`.
- `src/features/transactions/useTransactions.ts`: `SaveVars` gained `occurredAt`; the optimistic-update object now carries a real `occurred_at` (from the form) alongside its own always-"now" `created_at` (the optimistic row's own technical stamp).
- `src/components/TransactionForm.tsx`: added a real Date field (date-only, defaults to today, loads the existing transaction's date when editing). New helper module `src/lib/transactionDate.ts` (`toLocalDateInputValue`, `occurredAtFromLocalDateInput`) converts between the `<input type="date">` value and a real ISO timestamp, storing local **noon** (not midnight) so the chosen calendar date can never appear to shift by a day under `toLocaleDateString()`-based display -- the same browser-local convention already used everywhere else in the app (see P2-2 below; this does not fix that gap, it stays consistent with it).
- Display: `TransactionTable.tsx`, `MobileTransactionCard.tsx`, `RecentActivityList.tsx`, and CSV export (`csvExport.ts`) all now render/export `occurred_at` instead of `created_at`.
- Period math: `src/lib/financialPeriods.ts`'s `transactionTime()` -- the single shared choke point `budgetMath.ts`, `financialAnalytics.ts` (Dashboard/Reports), and `transactionsAnalytics.ts` (Transactions-page analytics) all build on -- now reads `occurred_at`. This one change correctly propagates the fix to Dashboard, Reports, Budgets, and the Transactions page's Average-Daily-Burn/Top-Categories cards simultaneously, with no separate per-feature changes needed.
- `src/types/database.types.ts`: `transactions` and `v_tx_search` Row/Insert/Update types updated to match the pending migrations exactly (`occurred_at: string` required on `transactions`, `occurred_at: string | null` on the view, matching that table's other nullable-typed columns).

### What intentionally did NOT change

- `created_at` itself: never modified, never removed, still the row's real insertion timestamp (now actually sourced from the database's own `DEFAULT now()` on insert rather than the client's clock, a minor incidental improvement -- the explicit client-side `created_at: new Date().toISOString()` on insert was removed since it's redundant with the column default and less trustworthy than a server-generated timestamp for an audit field).
- `profiles.timezone` is still not read by any date/period calculation (P2-2, unchanged, explicitly out of scope for this Part) -- all "today"/"this month" boundaries continue to use the browser's local timezone via plain `Date` arithmetic, exactly as before. The new Date field's local-noon storage strategy was deliberately chosen to be consistent with this existing (unfixed) behavior rather than introducing new, inconsistent timezone logic alongside it.
- Dashboard/Reports/Budgets aggregate architecture: still fully client-side against `fetchTransactions`'s full result set (§8/P2-1's row-cap caveat is unchanged and unaffected by this Part).
- `sum_income_amount`/`sum_expense_amount`/`sum_category_amount` (still orphaned, still all-time, untouched).

### Tests added

`src/lib/transactionDate.test.ts` (new), plus updated/extended coverage in `financialPeriods.test.ts`, `budgetMath.test.ts`, `dashboardMath.test.ts`, `financialAnalytics.test.ts`, `transactionsAnalytics.test.ts`, `useReportsData.test.tsx`, `useBudgetsForPeriod.test.tsx`, `csvExport.test.ts`, `transactions.test.ts`, `TransactionForm.test.tsx`, `Budgets.test.tsx`, `Dashboard.test.tsx`, `Reports.test.tsx` -- every transaction fixture across these files now carries a deliberately-different `created_at` from its `occurred_at` so a regression back to reading `created_at` anywhere in the date-sensitive code paths would fail loudly. Full suite: 48 files, 427 tests passing.

### Deployment steps (not yet run -- requires explicit approval)

```bash
npx supabase migration list                          # confirm current state first
npx supabase db push                                  # applies both new migrations, in order
npx supabase gen types typescript --linked > src/types/database.types.ts   # optional: re-generate and diff against the hand-written update above
```

Post-deployment verification:
```sql
select column_name, is_nullable, column_default
from information_schema.columns
where table_name = 'transactions' and column_name = 'occurred_at';
-- expect: is_nullable = 'NO', column_default = null

select count(*) from public.transactions where occurred_at is null;
-- expect: 0

select indexname from pg_indexes
where tablename = 'transactions' and indexname = 'transactions_user_id_occurred_at_idx';
-- expect: 1 row
```

## 36. Backend Part 4 — Timezone Correctness + Server-Side Financial Aggregates + Row-Cap Elimination

**Status at start of this Part:** confirmed via `npx supabase migration list` that both Part 3 migrations (`20260914000000_add_transactions_occurred_at.sql`, `20260914000100_expose_occurred_at_in_v_tx_search.sql`) were deployed (local/remote timestamps matched), clearing this Part to build on `transactions.occurred_at` and `v_tx_search` as live schema. **Status at end of this Part: implemented in the repository, NOT yet applied to the live database** (no migration was pushed; see §36.12).

### 36.1 Canonical financial timezone policy

**Policy:** every financial period boundary -- Dashboard's "this month", Reports' N-month windows, a Budget's own month/year, and the Transactions page's date-range filter -- is defined in the user's **configured** `profiles.timezone`, never the browser/machine timezone the client happens to be running in.

**Before this Part:** `profiles.timezone` was persisted (Settings can read/write it) and fetched by `getProfile`/`useProfile`, but was not read by a single date/period calculation anywhere in the app (P2-2, confirmed again at the start of this Part by re-inspecting `financialPeriods.ts`, `financialAnalytics.ts`, `dashboardMath.ts`, `useReportsData.ts`, `useBudgetsForPeriod.ts`, and `transactionDate.ts`). Every "this month"/"today" boundary used the browser's local `Date` arithmetic instead.

**After this Part:**
- Server-side: `dashboard_summary()`, `reports_summary()`, and `budgets_progress()` (§36.4) each look up the caller's own `profiles.timezone` via `auth.uid()` and use it for every period-boundary computation, via Postgres's `timestamptz AT TIME ZONE tz` double-conversion (correct across DST, arbitrary IANA zones, and both positive/negative UTC offsets -- no hardcoded offsets anywhere). A profile row missing a timezone (should not happen given the `NOT NULL DEFAULT` constraint) falls back to `'UTC'` rather than erroring.
- Client-side transaction-date entry: `src/lib/transactionDate.ts` was rewritten (see §36.2) to anchor a picked calendar date in the CONFIGURED timezone rather than the browser's.
- Client-side date-range filtering (Transactions page): `TransactionFilterBar.tsx` was rewritten (see §36.7) to construct `fromISO`/`toISO` using the same configured-timezone conversion.
- CSV export Date columns (both Reports and Transactions pages) now format `occurred_at` in the configured timezone (see §36.7/§36.9), not `.toISOString()`'s UTC calendar date.
- `financialPeriods.ts`'s `monthRange`/browser-`Date`-based helpers remain as-is and are still used by the Transactions-page burn-rate analytics (`transactionsAnalytics.ts`) and its filter-bar category counts, which remain on browser-local period math -- see §36.13 for why these two were deliberately left out of this Part's scope, and the residual gap that leaves.

### 36.2 Transaction-date-input timezone compatibility (resolved before building aggregates, per instruction)

**The concrete failure mode this fixes:** with the Part 3 implementation (`occurredAtFromLocalDateInput`), a user with `profiles.timezone = America/Los_Angeles` who happens to be traveling (or has their OS clock set to) `Asia/Ho_Chi_Minh` and picks "2026-09-01" in the Date field would have that date anchored to **browser-local** noon: Sept 1, 12:00 in Ho Chi Minh City (UTC+7) = Sept 1, 05:00 UTC = Aug 31, 21:00/22:00 in Los Angeles (UTC-7/-8). Once `occurred_at` is later interpreted in the user's CONFIGURED timezone (as every period boundary now is), that transaction would silently land in **August**, not September -- the exact bug the task's example describes.

**Fix:** `src/lib/transactionDate.ts` was rewritten on top of a new `src/lib/timezone.ts` module (`zonedTimeToUtc`/`formatInTimeZone`, built on the platform `Intl` API only -- no new dependency, per instruction). `occurredAtFromZonedDateInput(value, timeZone)` now takes the picked YYYY-MM-DD **and the caller's real configured timezone**, and resolves it to the UTC instant of **noon in that timezone** (still noon, not midnight, for the same DST-transition-avoidance reason as Part 3 -- but now noon in the CONFIGURED zone, not the browser's). `toZonedDateInputValue(date, timeZone)` is the inverse, used to pre-fill the Date field when editing an existing transaction. `TransactionForm.tsx` now calls `useProfile(userId)` itself and passes `profile.data?.timezone` through (falling back to the browser's own timezone only for the brief window before that query resolves, with a dedicated effect that re-derives the Date field -- and only the Date field, never amount/merchant/note/category -- once the real timezone arrives, so an in-progress edit in that window is never silently discarded).

**Verified in `src/lib/timezone.test.ts`:** the exact scenario above (`zonedTimeToUtc({year:2026,month:9,day:1}, "America/Los_Angeles")` vs. the same call with `"Asia/Ho_Chi_Minh"`) now produces two genuinely different real instants, each of which reads back as "2026-09-01" **in its own zone** -- and critically, the Los Angeles-anchored instant is computed with zero reference to any other timezone, so nothing about the host browser's timezone can influence it. Also covered: UTC, a positive-offset non-US zone, and a real US DST transition date (2026-03-08) on both sides.

**Historical data:** Part 3's backfill (`occurred_at = created_at` for every pre-existing row) was **not** touched or re-run. Only transaction dates entered or edited **going forward**, through the rewritten `TransactionForm`, use the new configured-timezone conversion. This is an intentional distinction: pre-Part-3 historical rows already have an inherently approximate `occurred_at` (their real transaction date was never captured at all), and rewriting history to "fix" that approximation using a timezone that may not have even been the user's configured timezone at the time would introduce a new, undocumented discontinuity rather than remove one.

### 36.3 Row-cap dependency trace (Part B classification)

Every consumer of `fetchTransactions`/`useTransactions` (the unbounded, no-`.range()` query) was traced and classified:

| Consumer | Classification | Resolution this Part |
|---|---|---|
| `useDashboardData` (Dashboard) | (A) needs server aggregate | Moved to `dashboard_summary()` + `budgets_progress()`. No longer calls `useTransactions`. |
| `useReportsData` (Reports) | (A) needs server aggregate, PLUS (C) legitimately needs raw rows for CSV export | Summary/buckets/category math moved to `reports_summary()`. CSV export moved to the existing bounded/batched `fetchAllTransactionsWithFilters`, scoped to the report's own range+category (see §36.6). No longer calls `useTransactions`. |
| `useBudgetsForPeriod` (Budgets) | (A) needs server aggregate | Moved to `budgets_progress()`. No longer calls `useTransactions`. |
| `TransactionFilterBar` (category-count badges on the Transactions page) | (B) needs only a small bounded query | **Not resolved this Part** -- still calls `useTransactions` to derive per-category counts client-side. See §36.13. |
| `TransactionAnalytics` (Transactions-page "Average Daily Burn" / "Top Categories" cards) | (A) needs server aggregate (its own period math is browser-local, same class of bug as §36.1) | **Not resolved this Part** -- still calls `useTransactions`. See §36.13. |

Because the last two consumers remain, `fetchTransactions`/`useTransactions` (`src/lib/transactions.ts`, `src/features/transactions/useTransactions.ts`) were **not removed** (Part J: "if some legitimate-for-now use remains, document why rather than leaving a dangerous fetch-everything utility available without clear reason"). This is documented explicitly here and in the final report as the recommended next step.

### 36.4 Server aggregate function inventory

One new migration, `supabase/migrations/20260915000000_financial_aggregate_functions.sql`, adds three functions -- one per page, matching each page's actual current data requirements rather than a larger or smaller number chosen a priori:

**`dashboard_summary()`**
- Args: none. Returns: `jsonb` (`{month, prevMonth, cashflow[12], categoryBreakdown[<=4], recentTransactions[5], currentYear, currentMonth}`).
- `SECURITY INVOKER`, `STABLE`, `search_path` pinned to `public, pg_temp`.
- Ownership: derives `auth.uid()` internally; returns an empty-but-well-typed zero payload if null (RLS would already return zero rows regardless; this is defense-in-depth on top of that).
- Grants: `REVOKE ALL ... FROM PUBLIC`, `GRANT EXECUTE ... TO authenticated` only (not `anon`).
- Notably does NOT include budget data -- the Dashboard's budget snapshot reuses `budgets_progress()` below (via the `currentYear`/`currentMonth` this function returns), so a budgets failure and a transactions failure remain two independently retryable error states, exactly as before this Part.

**`reports_summary(p_months_count int, p_category_name text DEFAULT NULL)`**
- Returns: `jsonb` (`{totals, previousTotals, monthlyBuckets[], categoryTotals[], previousCategoryTotals[], categoryNames[], budgetsInRange[], rangeStart, rangeEnd, hasAnyTransactionsEver}`).
- Same `SECURITY INVOKER`/ownership/grants posture as `dashboard_summary()`.
- `rangeStart`/`rangeEnd` are returned so the client's CSV export (a genuinely-raw-rows need, see §36.3/§36.6) can reuse the EXACT instant bounds the server used, rather than recomputing the range client-side and risking drift.
- `hasAnyTransactionsEver` is a real all-time existence check (`EXISTS(...)`, index-backed, not a full scan), independent of the selected period -- preserves the pre-existing product distinction between "brand-new user" (empty state) and "real user with history, just none in this window" (real all-zero charts), which a naive "does this period have any data" check would have collapsed.

**`budgets_progress(p_year int, p_month int)`**
- Returns: `TABLE(category_id int, spent numeric)` -- one row per category with any expense spend in that period; a category with zero spend simply has no row (client defaults to 0 via `Map.get(id) ?? 0`).
- Same `SECURITY INVOKER`/ownership/grants posture.
- One grouped query returns spend for every category in the period at once -- used by BOTH the Budgets page and the Dashboard's budget snapshot, so a budget list of any size is never resolved with one spend query per budget (no N+1, confirmed by inspection: exactly one `budgets_progress` call per page render, joined client-side against the already-loaded `useBudgets` list).

None of the three functions accepts a `p_user_id` (or any client-supplied-identity) parameter, and none accepts a client-supplied timezone -- confirmed by re-reading the final SQL before writing this section.

**A second migration**, `supabase/migrations/20260915000100_drop_orphaned_sum_rpcs.sql`, drops `sum_income_amount(uuid)`, `sum_expense_amount(uuid)`, and `sum_category_amount(uuid,integer)` (see §36.5).

### 36.5 Old orphaned RPCs — removed, not merely deprecated

`sum_income_amount`/`sum_expense_amount`/`sum_category_amount` were re-checked for call sites before dropping them (per instruction: "verify no production code uses them before dropping"). Confirmed reachable only from three now-deleted files: `src/features/dashboard/useTotals.ts`, `src/features/budgets/useSpentAmount.ts`, and `getSpentAmount()` in `src/lib/budgets.ts` -- none of which were imported by any page or component (dead code; grepped for `useTotals`/`useSpentAmount`/`getSpentAmount` across `src/pages` and `src/components` with zero matches). All three frontend files/functions were deleted in this same Part, and the three RPCs are dropped outright (not left "deprecated") in `20260915000100_drop_orphaned_sum_rpcs.sql`.

Worth recording explicitly: these three functions were `GRANT`ed to `anon` in the original baseline schema, and none of them checked the caller's identity against the `uid`/`cat_id` argument they were given -- meaning an unauthenticated request could already query ANY user's all-time income/expense/category total by supplying an arbitrary UUID. This was a real, live exposure (a privacy issue in the same family as the `delete_user_everything` finding from Backend Part 2, though lower severity since it only leaked aggregate numbers, not records) that this Part's removal closes, on top of removing their all-time-only correctness problem (the original P1/P2 finding).

### 36.6 Dashboard architecture — before/after

**Before:** `useDashboardData` called `useTransactions` (unbounded) + `useBudgets`, and `computeDashboardSummary` (in `dashboardMath.ts`) scanned the full transaction array client-side for month/prevMonth totals, a 12-month cashflow series, top-4 category breakdown, the 5 most recent transactions, and per-budget spend.

**After:** `useDashboardData` calls `useDashboardSummary` (wraps `dashboard_summary()`) + `useBudgets` + `useBudgetsProgress` (wraps `budgets_progress()`, called with the `currentYear`/`currentMonth` the summary RPC returned). `dashboardMath.ts`'s `mapDashboardSummary` is now a pure transform from the RPC's jsonb payload (+ the already-loaded budget list + spend rows) into the exact same `DashboardSummary` shape the page has always rendered -- `Dashboard.tsx` itself required **no changes**. Loading/error states are still two independent flags (`transactions.*` from the summary query, `budgets.*` from `useBudgets`/`useBudgetsProgress` combined) exactly as before, so a budgets failure still only blanks the budget panel.

### 36.7 Reports architecture — before/after

**Before:** `useReportsData` called `useTransactions` (unbounded) + `useBudgets`; `financialAnalytics.ts`'s `sumIncomeExpense`/`rangeForLastNMonths`/`previousEquivalentRange`/`buildMonthlyBuckets`/`expenseCategoryTotals` computed everything client-side from the full array, for This Month/3/6/12-month windows.

**After:** `useReportsData` calls `useReportsSummary` (wraps `reports_summary(monthsCount, categoryName)`) + `useBudgets` + `useExportTransactionsWithFilters` (the existing exhaustively-batched export query from Part 2, now scoped to `[rangeStart, rangeEnd)` + the selected category rather than the whole unbounded history). Previous-period comparison uses the immediately-preceding window of equal length (`v_prev_range_start`/`v_prev_range_end` in SQL, matching the pre-existing `previousEquivalentRange` semantics exactly, including the year-boundary roll-over case). Monthly buckets are timezone-aware and zero-filled via `generate_series` LEFT JOINed against the real aggregate (§36.4), not silently dropped for empty months. `financialAnalytics.ts`'s now-dead raw-transaction versions of `sumIncomeExpense`/`rangeForLastNMonths`/`previousEquivalentRange`/`buildMonthlyBuckets` were removed (kept: `expenseCategoryTotals`, `savingsRate`, `percentChange`, and the `MonthlyBucket`/`CategoryAmount`/`PeriodTotals` types, all still used elsewhere). `Reports.tsx` required no changes beyond wiring `useProfile`'s timezone into the CSV export call (§36.9).

### 36.8 Budget architecture — before/after, N+1 confirmation

**Before:** `useBudgetsForPeriod` called `useTransactions` (unbounded) + `useBudgets`; `computeBudgetProgress`/`computeBudgetSpend` (in `budgetMath.ts`) scanned the full transaction array per budget, filtering by category+month/year, for EVERY budget in the period.

**After:** `useBudgetsForPeriod` calls `useBudgets` (unchanged -- the budget-definitions list is small, bounded by budget count not transaction count, never a row-cap concern) + a new `useBudgetsProgress` hook (wraps `budgets_progress(year, month)`). `budgetMath.ts`'s `computeBudgetSpend`/`computeBudgetProgress` (which scanned raw transactions) were replaced by `deriveBudgetProgress(budget, spent)`, a pure function taking an already-known `spent` number -- the 75%/95% threshold constants and `budgetToneFor`/`budgetStatusFor` logic are completely unchanged (still the single source of truth for those thresholds, now just fed a server-computed number instead of a client-computed one). Confirmed no N+1: `budgets_progress` is called exactly once per page render (one query, one grouped result covering every category), not once per budget row.

### 36.9 Transactions page & CSV export — regression status

**Server pagination (Part 2 architecture):** untouched. `transactionsWithFilters`, `fetchAllTransactionsWithFilters`, the exact page size/offset/`{count:"exact"}` behavior, and the `occurred_at` + `id` deterministic sort/tiebreak are all unchanged.

**Date-filter timezone correctness (Part G):** the date-range picker in `TransactionFilterBar.tsx` was rewritten. Two real, independent bugs were found and fixed while making it timezone-aware (both pre-dated this Part):
1. **Exclusive-bound bug:** `toISO` was previously set to the exact instant the user clicked on the calendar (effectively midnight of the END date), but `applyTransactionFilters` uses `.lt("occurred_at", toISO)` (an exclusive upper bound) -- so a selected end date was silently EXCLUDED from the results, and a single-day selection (`fromISO === toISO`) matched literally nothing. Fixed: `toISO` is now the start of the day **after** the selected end date, so the whole selected end day is genuinely included.
2. **Browser-timezone bug:** boundaries were constructed via `.toISOString()` on browser-local calendar dates. Fixed: boundaries are now constructed via `zonedTimeToUtc` using the user's configured `profiles.timezone` (fetched via `useProfile`, same fallback pattern as `TransactionForm`), so a selected calendar day means the same real day regardless of the browser's own timezone.

Both fixes are covered indirectly by `timezone.test.ts`'s primitives; the UI wiring itself was verified by code review and the existing `TransactionFilterBar.test.tsx` suite (unaffected assertions still pass) rather than a new interactive date-picker test, given the scope already covered this Part -- flagged as a residual test-coverage gap in §36.13.

**CSV export (Part H):** both the Transactions page's and the Reports page's CSV exports continue to use the exhaustive 500-row-batch architecture from Part 2 (`fetchAllTransactionsWithFilters`) -- neither was replaced with an aggregate, since a raw-row export genuinely needs raw rows. `buildTransactionsCsv` now takes an explicit `timeZone` parameter and formats the Date column via `formatInTimeZone` instead of `.toISOString().slice(0,10)` -- the latter could disagree with the configured timezone's calendar date for any transaction stored near a UTC-day boundary (a real, if narrow, pre-existing bug: noon-anchored instants can cross a UTC day boundary for timezones east of roughly UTC+12). The Date column still represents `occurred_at`, never `created_at`.

### 36.10 Row-cap exposure — before/after

| Page | Before this Part | After this Part |
|---|---|---|
| Dashboard | Unbounded `fetchTransactions` (entire history) fetched to compute a monthly summary | Bounded: `dashboard_summary()` returns a fixed-size payload (12 cashflow points, <=4 category rows, 5 recent transactions) regardless of the user's total transaction count |
| Reports | Same unbounded fetch, for up to a 12-month window | Bounded: `reports_summary()` returns a fixed-size payload (<=12 monthly buckets, one row per category actually present); CSV export uses the pre-existing exhaustive-batch architecture, which is correct at any volume by construction |
| Budgets | Same unbounded fetch, scanned per budget | Bounded: `budgets_progress()` returns one row per category with spend in the period (bounded by category count) |
| Transactions (table + pagination) | Already bounded since Part 2 | Unchanged, still bounded |
| Transactions (filter-bar category counts, burn-rate analytics) | Unbounded `fetchTransactions` | **Still unbounded** -- explicitly not addressed this Part, see §36.13 |

A user with 100, 1,000, 5,000, or 50,000+ transactions: Dashboard/Reports/Budgets now issue queries whose RESULT size depends only on the number of months/categories/budgets involved, never on total transaction count -- the underlying `SUM`/`GROUP BY` work scales with the number of matching rows Postgres scans (bounded by the query's own date-range predicate, using the existing `transactions_user_id_occurred_at_idx` index from Part 3), not with the size of any PostgREST response. The Transactions page's filter-bar/analytics gap above is the one place this guarantee does NOT yet hold.

### 36.11 Index review

Part 3's `transactions_user_id_occurred_at_idx` on `(user_id, occurred_at DESC)` is used by every new function's `WHERE user_id = ... AND occurred_at >= ... AND occurred_at < ...` predicate. No new index was added. `GROUP BY category_id`/`GROUP BY category_id, date_trunc(...)` in `reports_summary`/`budgets_progress` group an already-range-filtered, per-user row set (typically hundreds to low thousands of rows even for a heavy user's single month/year window), which Postgres can sort/hash-aggregate in memory without a dedicated index at any realistic Nexali transaction volume -- so a `(user_id, category_id, occurred_at)` index was deliberately NOT added, per instruction ("only add indexes supported by real query patterns, documented reasoning"), pending an actual `EXPLAIN ANALYZE` on the deployed database if a specific slow query is ever observed.

### 36.12 Numeric precision, NULL handling, generated types

- **Precision:** `transactions.amount`/`budgets.amount` are `numeric(10,2)`. Every `SUM`/arithmetic expression in the new functions stays in Postgres `numeric` end to end; `jsonb_build_object`/`jsonb_agg` serialize a `numeric` value as a real JSON number (not a string), so no value is routed through `float8` inside SQL. The frontend wrappers (`src/lib/financialAggregates.ts`) still defensively call `Number(...)` on every numeric field, consistent with how the rest of the codebase already treats `numeric` columns coming back through PostgREST/RPC.
- **NULL/empty handling:** every `SUM(...)` that could return SQL NULL (no matching rows) is wrapped in `COALESCE(..., 0)`, since zero is the correct product meaning in every case here (no income this month is $0 income, not "unknown"). Empty months in `cashflow`/`monthlyBuckets` are explicitly zero-filled via `generate_series` LEFT JOINs rather than silently omitted, preserving the exact chart behavior the client-side `buildMonthlyBuckets` used to provide.
- **Generated types:** `src/types/database.types.ts`'s `Functions` block was hand-updated (no live database to regenerate against) -- `sum_income_amount`/`sum_expense_amount`/`sum_category_amount` removed, `dashboard_summary`/`reports_summary`/`budgets_progress` added with explicit `Args`/`Returns` shapes. Recommended: re-run `npx supabase gen types typescript --linked` after deployment and diff against this hand-written version (same recommendation as Part 3).

### 36.13 Explicitly deferred (documented per Part J, not silently dropped)

Two real, pre-existing row-cap/timezone gaps were identified but **not** fixed this Part, to keep scope to what was explicitly mandated (Dashboard/Reports/Budgets):

1. **`TransactionFilterBar`'s category-count badges** call `useTransactions` (unbounded) purely to compute a `Record<categoryName, count>` for the filter dropdown's badge numbers. This is a small, bounded-by-category-count result that belongs behind a dedicated grouped-count RPC, not a reason to fetch full history.
2. **`TransactionAnalytics`'s "Average Daily Burn"/"Top Categories" cards** (below the Transactions table) call `useTransactions` (unbounded) and compute period math (`resolveBurnPeriod`) using the same browser-local `Date` arithmetic this Part fixed everywhere else.

Because these two consumers remain, `fetchTransactions`/`useTransactions` were kept rather than removed (Part J). This is the top recommendation for Backend Part 5 (§ Recommended Backend Part 5, final report).

### 36.14 Files changed this Part

**New:** `src/lib/timezone.ts` (+test), `src/lib/financialAggregates.ts`, `src/features/dashboard/useDashboardSummary.ts`, `src/features/reports/useReportsSummary.ts`, `src/features/budgets/useBudgetsProgress.ts`, `supabase/migrations/20260915000000_financial_aggregate_functions.sql`, `supabase/migrations/20260915000100_drop_orphaned_sum_rpcs.sql`.

**Rewritten:** `src/lib/transactionDate.ts` (+test), `src/features/dashboard/dashboardMath.ts` (+test), `src/features/dashboard/useDashboardData.ts`, `src/features/reports/useReportsData.ts` (+test), `src/features/budgets/useBudgetsForPeriod.ts` (+test), `src/lib/budgetMath.ts` (+test), `src/lib/financialAnalytics.ts` (+test, trimmed), `src/lib/csvExport.ts` (+test), `src/components/TransactionForm.tsx` (+test), `src/components/TransactionFilterBar.tsx` (+test), `src/pages/Reports.tsx`, `src/pages/Transactions.tsx`, `src/features/querykeys.ts`, `src/features/transactions/useTransactions.ts` (invalidation fix, see below), `src/types/database.types.ts`.

**Deleted:** `src/features/dashboard/useTotals.ts`, `src/features/budgets/useSpentAmount.ts`, `getSpentAmount()` from `src/lib/budgets.ts`.

**Also fixed (discovered during this Part, not pre-existing scope but load-bearing for it):** `useTransactions.ts`'s `invalidateRelatedQueries` previously invalidated `qk.totals`/`qk.spentRoot` (the now-deleted hooks' cache keys). Since Dashboard/Reports/Budgets no longer share ONE `useTransactions` cache the way they used to, a transaction add/edit/delete would have silently stopped refreshing the Dashboard/Reports/Budgets summaries after this Part's changes without an explicit fix -- `invalidateRelatedQueries` now invalidates `qk.dashboardSummary`, `qk.reportsSummaryRoot`, and `qk.budgetsProgressRoot` (new prefix-matching root keys added to `querykeys.ts` so every cached period/category/year-month variant is invalidated in one call) alongside the existing `qk.txRoot`.

### 36.15 Quality gates (this Part)

`npm run test`: 49 files, 427 tests, all passing. `npm run lint`: 0 errors, 0 warnings. `npm run build`: succeeds (pre-existing >500kB chunk-size warning, unrelated to this Part). `npx tsc -b --force`: 0 errors.

**Not run:** any execution of the new SQL against a real Postgres instance (local or remote) -- per instruction, no `supabase db reset`, no automatic `db push`. The SQL was hand-reviewed multiple times for syntax and semantic correctness (variable declarations, type compatibility between `generate_series`/`date_trunc` naive-timestamp joins, RLS-equivalent ownership filtering, half-open range consistency) but has not been executed. See the final report's exact verification SQL for the recommended first checks after a real deployment.

## 37. Backend Part 5 — Transactions Page: Category Counts, Analytics, and Retiring fetchTransactions/useTransactions

**Status at start of this Part:** confirmed via `npx supabase migration list` that all eight migrations, including both Backend Part 4 migrations (`20260915000000_financial_aggregate_functions.sql`, `20260915000100_drop_orphaned_sum_rpcs.sql`), showed matching local/remote timestamps -- deployed. Working tree was clean and pushed. **Status at end of this Part: implemented in the repository, NOT yet applied to the live database** (no migration was pushed).

### 37.1 The two remaining consumers, exact semantics (Parts A/B/C)

Before writing any server code, both remaining `fetchTransactions`/`useTransactions` consumers identified in Backend Part 4 §36.3/§36.13 were re-read in full and their exact current behavior documented (not assumed):

**`TransactionFilterBar`'s category-count badges** (`useTransactionCounts()` in the now-removed `src/lib/transactions.ts`, called against the full unbounded `useTransactions(userId)` result with zero filter arguments): an **all-time** tally per category NAME, grouping a transaction with no category under the literal string `"Uncategorized"`, and completely **independent of every other active filter** -- date range, search, type, amount, and even the category filter itself. Confirmed this is not a faceted-search pattern (counts do not react to other active filters) by tracing that `useTransactions(userId)` took no filter parameters at all. Preserved exactly, per instruction not to adopt a "counts exclude the category filter" faceted-search pattern automatically.

**`TransactionAnalytics`'s "Average Daily Burn"/"Top Categories"** (`resolveBurnPeriod`/`computeDailyBurn`/`topExpenseCategories`/`dailyExpenseBuckets` in the now-largely-removed `src/lib/transactionsAnalytics.ts`):
- Period: the Transactions page's active date-range filter (`filters.fromISO`/`toISO`) when set, otherwise the current calendar month through today ("month to date").
- Expense transactions only; income is never counted as "burn".
- `dailyRate = (sum of expense amounts in period) / (period's calendar-day count)`.
- Previous-period comparison is **asymmetric by design** and was preserved exactly rather than "fixed" into false consistency: for an active date filter, the previous period is the immediately preceding window of the **same day-length**; for month-to-date, the previous period is the **entire previous calendar month** (not just "the same number of days elapsed").
- `previousDailyRate` (and therefore `changePercent`) is `null` both when there is no previous-period data at all, AND when the previous period's real expense total was exactly `$0` -- a `$0` previous period is treated as "no truthful baseline to compare against", not a real baseline. Preserved exactly.
- Top Categories: expense-only, sorted by amount descending with a category-name tiebreak, percent computed against the period's total expense (not the topN subset's own total), fixed at the top 4 (no variable topN in the UI).
- Search/type/amount/category filters do **not** narrow analytics (only the date filter does) -- explicitly documented in the pre-existing code as deliberate, to avoid the "Top Categories filtered by category" degenerate case.
- A 14-day (max) daily-expense sparkline, oldest first, zero-filled for days with no expenses.
- **The residual browser-timezone bug:** `resolveBurnPeriod`'s date-filter branch took the ALREADY timezone-correct `fromISO` (a Backend Part 4-fixed instant) and re-derived "start of day" from it via `new Date(fromISO); start.setHours(0,0,0,0)` -- browser-LOCAL hour-zeroing, which could shift the classified calendar day when the browser's timezone differs from `profiles.timezone`, reintroducing the exact class of bug Backend Part 4 fixed everywhere else. Fixed this Part (see §37.3).

### 37.2 Category-count server function

**`transaction_category_counts()`** -- no arguments, `RETURNS TABLE(category_name text, count bigint)`, `LANGUAGE sql`, `SECURITY INVOKER`, `STABLE`, `search_path` pinned, `authenticated`-only grants (revoked from `PUBLIC`/`anon`). Groups `COALESCE(c.name, 'Uncategorized')` for `WHERE t.user_id = auth.uid()` -- matching the removed client-side function's exact keying (by name, not id; an unauthenticated caller naturally gets zero rows since `t.user_id = NULL` is never true, no explicit branch needed). No date/type/amount/search/category parameters were added, since the confirmed current semantics are filter-independent -- adding filter parameters would have been a silent behavior change, not a preservation of existing behavior.

### 37.3 Transactions-analytics server function

**`transactions_activity_summary(p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)`** -- `RETURNS jsonb`, `SECURITY INVOKER`, `STABLE`, `search_path` pinned, `authenticated`-only grants.

`p_from`/`p_to` (both required together, or both omitted) are the **already timezone-correct** half-open instant bounds `TransactionFilterBar` constructs for its active date filter (`startOfDayIso`/`startOfNextDayIso`, established in Backend Part 4) -- passed straight through, unmodified, rather than re-derived. This is explicitly **not** "trusting a client-supplied timezone": an absolute instant is unambiguous regardless of who computed it, unlike an IANA zone string. Period **classification** (which calendar day/month an instant belongs to) still always uses the server's own `profiles.timezone` lookup via `auth.uid()`, never anything client-supplied -- when `p_from`/`p_to` are omitted, the "month to date" default is computed entirely server-side from the caller's configured timezone, fixing the browser-timezone bug in §37.1's last bullet.

All calendar-day-count arithmetic (`days`, `previousDays`, the previous-period start, the sparkline's day boundaries) is done on the **naive local timestamp representation** (`timestamptz AT TIME ZONE tz`, then plain date/interval arithmetic, then converted back via `AT TIME ZONE tz`) rather than `timestamptz +/- interval` directly -- the latter is documented Postgres behavior to operate in the *session's* `TimeZone` setting, not an explicit zone, which would have silently reintroduced a session-timezone dependency into supposedly-configured-timezone-only math. This is the same safe pattern Backend Part 4 established for month arithmetic, applied here for day arithmetic too.

Returns `{rangeStart, rangeEnd, previousRangeStart, previousRangeEnd, days, previousDays, isCustomRange, expenseAmount, dailyRate, previousDailyRate, changePercent, dailyBuckets[], topCategories[]}`. Locale-aware LABEL text ("Sep 1 – Sep 15 (month to date)") is deliberately **not** computed server-side -- it is a presentation concern that legitimately depends on the viewer's own locale, not a financial-classification concern -- and is built client-side (`buildActivityLabel` in `src/lib/transactionsAnalytics.ts`) from the real `rangeStart`/`rangeEnd`/`isCustomRange` this function returns, the same pattern Backend Part 4 used for Dashboard/Reports month labels.

**Input validation:** `p_from`/`p_to` must both be given or both omitted (`RAISE EXCEPTION` otherwise); `p_from` must be strictly before `p_to`. No `topN` parameter exists at all (Top Categories is fixed at 4, matching the UI's own fixed requirement -- "prefer fixed server behavior where the UI requirement is fixed", avoiding any arbitrarily-large-topN concern entirely rather than needing to clamp one).

**No `SECURITY DEFINER` was used or considered necessary** for either function -- `SECURITY INVOKER` with the existing `auth.uid()`-scoped RLS policies on `transactions`/`categories`/`profiles` is sufficient for both, exactly as it was for every Backend Part 4 function.

### 37.4 Query keys and mutation/category invalidation

Added: `qk.categoryCounts(userId)` (no variant -- the count is all-time and filter-independent, so its root IS its full key) and `qk.activitySummaryRoot(userId)`/`qk.activitySummary(userId, fromISO, toISO)` (varies by the active date filter, or its absence). Removed: `qk.transactions(userId)` (the leaf key for the now-deleted `useTransactions` hook; `qk.txRoot` itself is retained since `txSearch`/`txExport` still build on it), `qk.totals`/`qk.spentRoot`/`qk.spent` were already removed in Backend Part 4 and remain removed.

**Mutation invalidation (Part J):** `useTransactions.ts`'s shared `invalidateRelatedQueries` now also invalidates `qk.categoryCounts(userId)` and `qk.activitySummaryRoot(userId)` alongside the existing `qk.txRoot`/`qk.dashboardSummary`/`qk.reportsSummaryRoot`/`qk.budgetsProgressRoot` -- verified with a new integration-style test (`src/features/transactions/useTransactions.test.tsx`, real `QueryClient`, spied `invalidateQueries`) asserting both keys are invalidated after a real `useSaveTransaction`/`useDeleteTransaction` mutation, including the failure path (`onSettled` runs regardless of outcome). This is the exact class of stale-cache bug Backend Part 4 found and fixed for its own two new caches -- re-verified explicitly here per instruction, rather than assumed to still be correct.

**Category mutations (corrected -- see §37.4.1):** an earlier draft of this report argued that no category-mutation invalidation was needed because `transaction_category_counts()`/`transactions_activity_summary()` "read `categories.name` live at query time." That reasoning was wrong: the server reading a fresh name on its *next* query is irrelevant to whether TanStack Query actually issues that next query -- a cached result stays cached, and continues being served to the UI as-is, until something invalidates it. The server being correct does not make the client cache correct. This has been fixed; see §37.4.1.

#### 37.4.1 Category rename/create/delete cache correctness

**Mutations that actually exist today (traced, not assumed):** `src/lib/categories.ts`/`src/features/categories/useCategories.ts` were re-read in full, and the whole repo was grepped for `.update(`/`.delete(` against the `categories` table and for `rename`/`editCategory`/`deleteCategory`/`ManageCategories`. Result: **Nexali's frontend has no category rename or delete mutation at all** -- the only category-mutating code path is `upsertCategory()` (find an exact-name-match category, or insert a new one; it never updates an existing row's `name`), exposed via `useCreateCategory`. This is stated plainly here rather than assumed, since the original task described rename/delete as if they were existing mutations to fix in place.

**Category CREATE:** confirmed a brand-new category cannot appear in any transaction-derived aggregate, because it has zero transactions at the moment it's created -- `transaction_category_counts()` (an inner-joined `GROUP BY`), `transactions_activity_summary()`'s `topCategories`, `dashboard_summary()`'s `categoryBreakdown`, and `reports_summary()`'s `categoryTotals`/`categoryNames` are all derived FROM existing transactions, not from the category list itself. So create needs, and gets, **no** aggregate-cache invalidation -- only the category list itself. That said, `useCreateCategory`'s existing invalidation (`qk.categories(userId, vars.type)`) had its own narrower bug: it invalidated only the created category's own type-variant, leaving the `"all"`-type list (`CategoryFilterDropdown`) and the other type's list stale. Fixed by invalidating the new `qk.categoriesRoot(userId)` prefix instead (covers every type variant in one call), the same `*Root` convention used everywhere else in this file.

**Category RENAME/DELETE (no mutation exists to attach this to yet, but the correct invalidation is now defined, tested, and ready):** added `invalidateCategoryDependentQueries(qc, userId)` (`src/features/categories/useCategories.ts`), an exported, directly-tested async function that invalidates every cache actually confirmed (by re-reading each query/RPC's real return shape, not assumed) to embed a category's `name`:
- `qk.categoriesRoot` / `qk.expenseCategories` -- the category lists themselves.
- `qk.txRoot` (covers `qk.txSearch` + `qk.txExport`) -- `v_tx_search`'s `category_name` column (`src/lib/transactions.ts`).
- `qk.categoryCounts` -- `transaction_category_counts()` returns `category_name` directly.
- `qk.activitySummaryRoot` -- `transactions_activity_summary()`'s `topCategories[].label`.
- `qk.dashboardSummary` -- `dashboard_summary()`'s `categoryBreakdown[].label` and `recentTransactions[].categories.name`.
- `qk.reportsSummaryRoot` -- `reports_summary()`'s `categoryTotals[].label`, `previousCategoryTotals[].label`, and `categoryNames[]`.
- `qk.budgetsRoot` -- `getBudgets()` embeds `categories: { name }` via its join (`src/lib/budgets.ts`); a plain table query, but still a cached result holding the old name.

**Deliberately excluded** (traced and confirmed NOT to embed a name, so invalidating them would be the "blindly invalidate everything" this function is written to avoid): `qk.budgetsProgressRoot` (`budgets_progress()` returns only `{category_id, spent}` -- the label is joined in client-side from the already-invalidated `qk.budgetsRoot`), `qk.profile`, `qk.avatar`.

A category **delete** would need the identical invalidation list -- `transactions.category_id`/`budgets.category_id` are both `ON DELETE SET NULL` (confirmed in `20260910235021_remote_schema.sql`), so deleting a category can change the same category-name-bearing results (rows move to "Uncategorized"), making this the same cache-correctness problem as rename, not a separate one.

This is intentionally **not** wired into a new rename/delete UI or mutation -- building one would be a new feature, not a cache-invalidation correction, and was out of scope for this fix. `invalidateCategoryDependentQueries` is written and positioned so that whichever mutation eventually implements rename/delete calls exactly this one function, rather than an ad hoc, likely-incomplete invalidation list being reinvented in a presentation component or a new hook.

**Tests** (`src/features/categories/useCategories.test.tsx`, real `QueryClient`, seeded cache entries, asserting `isInvalidated` directly -- proving real refetch eligibility, not merely that an RPC would return a fresh value): `invalidateCategoryDependentQueries` invalidates `categoryCounts`, every cached `activitySummary` variant, `dashboardSummary`, every cached `reportsSummary` variant, the category lists, `expenseCategories`, `txSearch`, and `budgetsRoot`; does **not** invalidate `budgetsProgress`, `profile`, or `avatar`. `useCreateCategory` invalidates every `qk.categories` type-variant but **not** any aggregate cache. `src/features/transactions/useTransactions.test.tsx` (transaction mutation invalidation) was re-run unchanged and still passes, confirming this fix did not alter transaction-mutation behavior.

**Optimistic-update cleanup (found and removed, not part of the original ask but directly relevant to it):** `useSaveTransaction`/`useDeleteTransaction` previously wrote optimistic updates into the `qk.transactions(userId)` cache (the now-removed `useTransactions` hook's key). Tracing every reader of that key found **zero** -- the Transactions table has used `qk.txSearch` (a different key, via `useTransactionWithFilters`) since Backend Part 2, so this optimistic-update machinery had already been fully inert (no observable UI effect) before this Part, and is now doubly so with `useTransactions` gone. Removed `onMutate`/`onError` rollback logic and the now-pointless `MutationContext` type from both mutation hooks, keeping only `mutationFn` + `onSettled: invalidateRelatedQueries` -- the real, invalidation-driven refetch that actually updates every visible UI element today. No test asserted on the removed optimistic behavior (confirmed by grep for "optimistic" across all test files before removing it).

### 37.5 Frontend wiring

`TransactionFilterBar.tsx`: replaced `useTransactions(userId)` + `useTransactionCounts(transactions)` with `useTransactionCategoryCounts(userId)` (wraps `transaction_category_counts()`), reduced client-side into the same `Record<categoryName, count>` shape `CategoryFilterDropdown` already expected -- that component required **zero changes**.

`TransactionAnalytics.tsx`: replaced `useTransactions(userId)` + the four pure client-side analytics functions with `useTransactionsActivitySummary(userId, filters.fromISO, filters.toISO)` (wraps `transactions_activity_summary()`). `src/lib/transactionsAnalytics.ts` was reduced to just `buildActivityLabel()` (the locale-formatting function, §37.3); `resolveBurnPeriod`/`computeDailyBurn`/`topExpenseCategories`/`dailyExpenseBuckets` were removed (their SQL equivalents in §37.3 replace them). The component's JSX/markup/loading-skeleton/error-state structure is unchanged -- only its data source.

### 37.6 fetchTransactions / useTransactions — final status: removed

Traced every remaining reference to `fetchTransactions`/`useTransactions` before removing anything (Part A): zero production call sites remained after §37.5's rewiring (confirmed by `grep -rn "useTransactions(\|fetchTransactions(" src`, matching only the hooks' own definitions and one now-also-removed test). Removed: `fetchTransactions()` and `useTransactionCounts()` from `src/lib/transactions.ts`; `useTransactions()` from `src/features/transactions/useTransactions.ts`; the `qk.transactions` query key; the dead `fetchTransactions`/`useTransactionCounts` describe blocks from `src/lib/transactions.test.ts`. `useDeleteTransaction`, `useSaveTransaction`, `useTransactionWithFilters`, and `useExportTransactionsWithFilters` -- all still legitimately used -- remain in the same file, since they are genuinely different (bounded/mutation) query shapes, not the general-purpose unbounded fetch.

No silent fallback was introduced anywhere: if `transaction_category_counts()`/`transactions_activity_summary()` fail, `TransactionFilterBar`/`TransactionAnalytics` show their existing error state (a real retryable error / the existing `ErrorState` component) -- there is no "aggregate failed, so fetch everything and compute locally" fallback path anywhere in the codebase, which would have silently reintroduced the exact row-cap risk this Part removes.

### 37.7 Row-cap exposure — final status

| Data path | Status |
|---|---|
| Transactions table (server pagination) | Bounded since Backend Part 2 |
| CSV export (Transactions + Reports) | Bounded (exhaustive 500-row batches) since Backend Part 2 |
| Dashboard / Reports / Budgets | Bounded since Backend Part 4 |
| Transactions category-count badges | **Bounded as of this Part** -- result size is the user's distinct category count, never their transaction count |
| Transactions analytics (burn/top categories) | **Bounded as of this Part** -- result size is fixed (<=14 buckets, <=4 categories), never the user's transaction count |

There is now **no remaining general-purpose "fetch every transaction belonging to this user" query anywhere in Nexali's production code.** At 100/1,000/5,000/50,000+ transactions, every one of the above paths issues a query whose *result* size is bounded by page size, category count, or a fixed small N -- never by transaction history size; the underlying `COUNT`/`SUM`/`GROUP BY` work itself scans only rows matched by an indexed `user_id`(+`occurred_at` where applicable) predicate, using the same `transactions_user_id_occurred_at_idx` from Backend Part 3. No new index was added this Part -- the category-count query groups by category (bounded by category count, not transaction count) and the activity-summary query's predicates are identical in shape to Backend Part 4's already-justified access pattern, so `(user_id, category_id, occurred_at)` remains unjustified without a real observed slow query, per the same reasoning as Backend Part 4 §36.11.

### 37.8 Numeric precision, empty/null handling, generated types

Same posture as Backend Part 4: every `SUM`/arithmetic expression stays in Postgres `numeric`; `COUNT(*)` returns `bigint`, which PostgREST/the wire protocol may represent as either a JSON number or a numeric string depending on client library version, so `getTransactionCategoryCounts()`'s wrapper defensively `Number(...)`-coerces it either way (covered by `financialAggregates.test.ts`). `previousDailyRate`/`changePercent` are real `NULL` (not `0`) when there is no truthful baseline, per §37.1's preserved semantics -- the frontend type (`number | null`) and every consumer were checked to render "No previous-period data" rather than a fabricated `$0`/`0%`. Daily buckets are zero-filled via the same `generate_series` LEFT JOIN pattern as Backend Part 4's monthly buckets, never silently omitted. `src/types/database.types.ts` gained `transaction_category_counts`/`transactions_activity_summary` entries with explicit `Args`/`Returns`.

### 37.9 Files changed this Part

**New:** `supabase/migrations/20260916000000_transactions_page_aggregate_functions.sql`, `src/features/transactions/useTransactionCategoryCounts.ts`, `src/features/transactions/useTransactionsActivitySummary.ts`, `src/features/transactions/useTransactions.test.tsx` (new invalidation regression test), `src/lib/financialAggregates.test.ts` (new wrapper-parsing test), `src/features/categories/useCategories.test.tsx` (new category-invalidation regression test, §37.4.1).

**Rewritten:** `src/lib/transactionsAnalytics.ts` (trimmed to `buildActivityLabel` only), `src/components/TransactionAnalytics.tsx` (+test), `src/components/TransactionFilterBar.tsx` (+test), `src/features/transactions/useTransactions.ts` (removed `useTransactions`, removed dead optimistic-update logic, extended `invalidateRelatedQueries`), `src/lib/transactions.ts` (removed `fetchTransactions`/`useTransactionCounts`), `src/lib/financialAggregates.ts` (added two new wrapper functions/types), `src/features/querykeys.ts` (added `qk.categoriesRoot`, §37.4.1), `src/features/categories/useCategories.ts` (added `invalidateCategoryDependentQueries`, broadened `useCreateCategory`'s invalidation, §37.4.1), `src/types/database.types.ts`, `src/pages/Transactions.test.tsx` (updated mocks).

**Deleted (functions/exports, not files):** `fetchTransactions()`, `useTransactionCounts()` (`src/lib/transactions.ts`); `useTransactions()` (`src/features/transactions/useTransactions.ts`); `resolveBurnPeriod`/`computeDailyBurn`/`topExpenseCategories`/`dailyExpenseBuckets` (`src/lib/transactionsAnalytics.ts`); `qk.transactions` (`src/features/querykeys.ts`); the dead optimistic-update `onMutate`/`onError` blocks and `MutationContext` type in `useTransactions.ts`.

### 37.10 Quality gates (this Part)

`npm run test`: 52 files, 443 tests, all passing. `npm run lint`: 0 errors, 0 warnings. `npm run build`: succeeds (same pre-existing >500kB chunk-size warning, unrelated). `npx tsc -b --force`: 0 errors.

**Not run:** execution of the new SQL against any real Postgres instance -- same posture as Backend Part 4, hand-reviewed only. See the final report for exact post-deployment verification SQL.

## 38. Backend Part 6 — Profile + Settings Schema Completion, Real Preference Persistence, App-Wide Formatting

**Status at start of this Part:** confirmed via `npx supabase migration list` that all nine migrations, including `20260916000000_transactions_page_aggregate_functions.sql` (Backend Part 5), showed matching local/remote timestamps -- deployed. **Status at end of this Part: implemented in the repository, NOT yet applied to the live database.**

### 38.1 Field matrix (Part A) -- re-audited from current code, not assumed

| Field | Before this Part | After this Part |
|---|---|---|
| Profile: full_name | A (already persisted, already editable) | unchanged |
| Profile: avatar_url | A (already persisted, via Storage) | unchanged |
| Profile: budget_reset_cycle / reset_day | A (already persisted, already editable) | unchanged |
| Profile: timezone | A (already persisted; editable on Settings, read-only summary on Profile) | unchanged |
| Profile: phone | B (frontend-pending -- disabled `<input>`, "Coming soon", no column) | **A** -- real `profiles.phone`, editable |
| Profile: location | B (same pattern) | **A** -- real `profiles.location`, editable |
| Profile: financial_bio | B (same pattern) | **A** -- real `profiles.financial_bio`, editable, live char counter |
| Settings: currency | B (disabled Select, hardcoded `"USD"`, no column) | **A** -- real `profiles.currency`, editable |
| Settings: timezone | A (already real, already editable) | unchanged |
| Settings: date format | B (disabled Select, hardcoded `"mdy"`, no column) | **A** -- real `profiles.date_format`, editable |
| Settings: number format | B (disabled Select, hardcoded `"standard"`, no column) | **A** -- real `profiles.number_format`, editable |
| Settings: appearance/theme | **E** (should not exist -- Nexali is dark-only v1; Lovable's Appearance section shows a static "Nexali Obsidian Dark" badge, not a real theme picker) | unchanged, confirmed correctly absent |
| Settings: reduce animations | **D** (out of scope -- no app-wide motion-reduction implementation exists to back it) | unchanged, still disabled/"Coming soon" |
| Settings: show chart values | **D** (same -- no app-wide chart-value-toggle implementation exists) | unchanged, still disabled/"Coming soon" |
| Settings: notification preferences | **D** (explicitly out of scope for this Part per instruction) | unchanged, still disabled/"Coming soon" |

No field was found to already secretly exist under a different name; no field was found to need a CHECK constraint the current UI doesn't already imply (financial_bio's 240-char limit was already a real, shipped UI contract -- `BIO_LIMIT`/`maxLength` in the pre-existing Profile.tsx).

### 38.2 New `profiles` columns (Part B/C)

All six added in one migration, `supabase/migrations/20260917000000_profile_settings_preferences.sql`:

| Column | Type | Nullable | Default | CHECK |
|---|---|---|---|---|
| `phone` | `text` | NULL | none | none (deliberately unvalidated -- see below) |
| `location` | `text` | NULL | none | none |
| `financial_bio` | `text` | NULL | none | `char_length(financial_bio) <= 240` (matches the pre-existing UI's own `BIO_LIMIT`) |
| `currency` | `text` | NOT NULL | `'USD'` | `currency IN ('USD','EUR','GBP','CAD','AUD','JPY')` (exactly Settings' real `CURRENCY_OPTIONS`) |
| `date_format` | `text` | NOT NULL | `'mdy'` | `date_format IN ('mdy','dmy','ymd')` (exactly Settings' real `DATE_FORMAT_OPTIONS`) |
| `number_format` | `text` | NOT NULL | `'standard'` | `number_format IN ('standard','european','space')` (exactly Settings' real `NUMBER_FORMAT_OPTIONS`) |

**Phone:** stored as free-text, deliberately unvalidated against any international format. The current frontend's phone field is a plain `<input type="tel">` with no format contract of its own -- inventing a validation rule now would be adding a restriction the product never asked for, not preserving one. **Location:** plain user-entered text, display/context metadata only -- no geocoding, no structured address, no coordinates. **Financial bio:** user-authored context for Aura, never an Aura prompt or generated output -- length-capped to match the shipped UI exactly.

### 38.3 Existing-user migration behavior (Part Q)

Every new column is either nullable-with-no-default (`phone`/`location`/`financial_bio` → every existing row gets real `NULL`, matching "no info entered yet") or `NOT NULL DEFAULT` chosen to exactly reproduce Nexali's pre-existing implicit behavior: `currency DEFAULT 'USD'` (the app's formatCurrency hardcoded default before this Part), `date_format DEFAULT 'mdy'` (what the disabled Settings Select always showed as selected, and what `toLocaleDateString()`'s en-US-style rendering always effectively produced), `number_format DEFAULT 'standard'` (what the disabled Settings Select always showed, and what formatCurrency's hardcoded `"en-US"` locale always effectively produced). **No existing user sees any unexpected formatting change on deploy** -- every default was chosen specifically to reproduce current behavior byte-for-byte, not to introduce a new opinion.

### 38.4 `handle_new_user` (Part R)

**Not modified.** All six new columns have safe column-level defaults (`NULL` or a literal), matching the exact same pattern already established for `budget_reset_cycle`/`reset_day`/`timezone`, none of which `handle_new_user` sets explicitly either (it only sets `id`/`full_name`/`avatar_url`; every other column relies on its own `DEFAULT`). A new user row picks up correct defaults automatically with zero trigger changes.

### 38.5 Profile page (Part G/H)

`UpdateProfileVars` (`src/features/profiles/useProfile.ts`) extended with `phone`/`location`/`financial_bio` (all `string | null`) and `currency`/`date_format`/`number_format` (all editable via Settings, not Profile -- see §38.6). `lib/profile.ts`'s `getProfile`/`ProfileSelect` extended to select and type all six new columns.

Phone/Location/Financial bio are now real, enabled, editable fields wired into Profile's existing `FormState`/dirty-state/save/discard machinery (the exact same pattern `full_name` already used) -- no new architecture was introduced. On save: values are trimmed; a blank field is sent as real `NULL` (not an empty string, since these are optional fields and `NULL` is the intended "not set" representation, matching the migration's own column semantics), and a save failure leaves the entered (untrimmed) text exactly as typed, matching the existing full_name failure behavior. The Financial bio character counter (`{form.financialBio.length}/240`) is now real and live, replacing the previous hardcoded `0/240`.

**Preferences summary (unchanged pattern):** Profile's "Preferred currency" row remains a static, read-only summary -- Settings remains the sole editor -- but now displays the real persisted `profiles.currency` (via the shared `currencyLabel()` helper in the new `src/lib/preferenceOptions.ts`) instead of a hardcoded `"USD ($)"` constant. Neither currency nor timezone participates in Profile's dirty state or Save payload, exactly as before.

### 38.6 Settings page (Part I)

Currency/date format/number format converted from disabled `<Select value="X" disabled>` controls to real, enabled, two-way-bound controls, backed by a `FormState` mirroring Profile's own pattern (`{timezone, currency, dateFormat, numberFormat}`, loaded once from the profile query, diffed against a `saved` baseline for dirty state). The "Coming soon -- not saved yet." caption was removed from exactly these three fields and nowhere else -- Reduce animations, Show chart values, every Notification-preference row, and the Appearance section's theme badge all keep their pending captions/disabled state unchanged, since none of them has any backing column or app-wide behavior yet (confirmed by re-inspection, not assumed).

**Dirty state:** now `true` whenever any of the four real fields (`timezone`, `currency`, `dateFormat`, `numberFormat`) differs from its saved baseline -- verified with a dedicated test that changing currency alone enables Save/Discard exactly like changing timezone alone always did. Every still-disabled control (reduce animations, notifications, etc.) cannot affect dirty state at all, since there is nothing to interact with.

**Save:** one `useUpdateProfile.mutate(...)` call always carrying the full current value of all four real fields together (`{timezone, currency, date_format, number_format}`) -- never one mutation per dropdown, and never a partial/diff-only payload, so a save always leaves the four fields mutually consistent even when the user changed several at once in the same visit.

**Discard:** resets the entire `form` object back to `saved` in one assignment -- all four fields restore together, never partially.

**Date-format preview:** now reads its example string from the shared `DATE_FORMAT_OPTIONS[...].preview` (via `src/lib/preferenceOptions.ts`) instead of a hardcoded `"10/24/2025"` literal, so it updates live as the user changes the selected format.

### 38.7 Currency: storage semantics, no FX conversion (Part J/currency semantics)

`profiles.currency` is an **account/display convention**, not a conversion instruction. Changing it from `USD` to `EUR` changes how existing (and future) stored amounts are *rendered* -- a different symbol/code and locale-appropriate separator placement -- and never rescales, converts, or otherwise mutates a single stored `transactions.amount`/`budgets.amount` value. This is explicit both in the migration's column comment and in `formatCurrency`'s own doc comment, and directly tested (`format.test.ts`: "does not perform FX conversion: the same numeric amount is shown under every currency, never rescaled"). Nexali has no multi-currency transaction model (no per-transaction currency column) -- this is a deliberate, documented limitation of the display-preference feature, not an oversight.

### 38.8 Currency formatting architecture (Part J/M/currency+number interaction)

`src/lib/format.ts`'s `formatCurrency(amount, currency = "USD", numberFormat: NumberFormatPref = "standard")` is the single shared formatter -- every production call site was traced (16 files) and converted from a static import to the new `useFormatCurrency()` hook. `numberFormat` selects a base locale purely for its separator CONVENTION (`standard` → `en-US`, `european` → `de-DE`), with `currency` always passed independently, so a currency choice can never silently override the user's chosen separator style (verified directly: `formatCurrency(1234.5, "EUR", "standard")` still uses comma-thousands/period-decimal, not German conventions). The `space` option (`1 234.56` -- space thousands, PERIOD decimal) does not correspond to any real-world ICU locale (every real space-thousands locale, e.g. `fr-FR`/`sv-SE`, pairs it with a comma decimal), so it is produced deterministically by post-processing `en-US`'s comma-thousands output rather than guessing at a locale -- guaranteeing Nexali's own documented example exactly, regardless of ICU version differences across browsers/environments.

### 38.9 Number-format architecture (Part K)

There is no separate app-wide "format a plain number" utility -- every place `number_format` is user-visible is a currency amount (confirmed by re-tracing every `formatCurrency` call site; no plain-number display anywhere needed thousands-separator behavior, e.g. category counts and percentages are always small integers where separator style is invisible). Adding a generic `formatNumber` with no real call site would have been exactly the "settings with no application behavior" anti-pattern this Part explicitly warns against for reduce-animations/show-chart-values -- so `number_format`'s real behavior is entirely expressed through `formatCurrency`'s locale selection (§38.8).

### 38.10 Date-format architecture (Part L)

Every `toLocaleDateString()`/date-rendering call site in the app was traced and classified:

- **(A) User-facing calendar dates, now honoring `date_format`:** the Transactions table's Date column, the Dashboard's Recent Activity list, and the mobile transaction card (`TransactionTable.tsx`, `RecentActivityList.tsx`, `MobileTransactionCard.tsx`) -- exactly three call sites. All three now call the new `useFormatDate()` hook (`src/lib/dateFormat.ts`'s `formatDate(date, dateFormat, timeZone)`), which also reads the calendar day in the caller's **configured** `profiles.timezone` (reusing the existing `formatInTimeZone` primitive from Backend Part 4) rather than the browser's own timezone -- closing a small pre-existing display gap (these three sites previously used browser-local `toLocaleDateString()`) at effectively zero extra cost, verified with an explicit no-browser-timezone-regression test.
- **(B) Machine/stable export date, deliberately NOT changed:** the CSV Date column (`buildTransactionsCsv`) stays fixed `YYYY-MM-DD` regardless of `date_format` -- see §38.11.
- **(C) Month/year-only semantic labels, deliberately NOT date_format-governed:** the Dashboard/Reports cashflow chart's month labels (`dashboardMath.ts`/`useReportsData.ts`'s `monthLabel`), the Transactions-analytics period label (`transactionsAnalytics.ts`'s `buildActivityLabel`), the date-range picker's compact chip label (`TransactionFilterBar.tsx`'s `formatShort`), and "Member since [Month Year]" (Profile/Account) -- none of these has a day-precision component for `mdy`/`dmy`/`ymd` to meaningfully reorder, so all were left as locale-aware short labels, not blindly routed through the new formatter.

### 38.11 CSV date-format decision (Part L/CSV)

**Deliberately unchanged.** The CSV export's Date column stays stable `YYYY-MM-DD` (via the existing `formatInTimeZone`) regardless of the user's `date_format` preference. This is a considered decision, not an oversight: CSV is a machine-readable/interoperable export format (the Backend Part 4/5 report already established this reasoning for keeping it stable rather than mirroring UI formatting), and Nexali's product behavior has never implied "export should visually match the screen" -- changing it now would be a scope-expanding behavior change, not a preservation of one. Batching/sort/filter/timezone-correctness of the export path are all unchanged from Backend Part 2/4/5.

### 38.12 Formatter access strategy (Part M)

A new `FormatPreferencesProvider` (`src/features/profiles/FormatPreferencesContext.tsx`) is mounted exactly once, in `AppLayout.tsx` (inside `AuthGate`, wrapping every authenticated route), backed by a single `useProfile(userId)` call -- the SAME cached query key every other Profile/Settings/Dashboard/Reports/Transactions consumer already subscribes to, so this adds zero new network requests. `useFormatPreferences()`/`useFormatCurrency()`/`useFormatDate()` (`src/features/profiles/useFormatPreferences.ts`) read from that one shared context rather than each of the 16+ leaf components independently calling `useProfile`. The context/provider/hooks are split across three small files (`formatPreferencesStore.ts`, `FormatPreferencesContext.tsx`, `useFormatPreferences.ts`) purely to satisfy the existing `react-refresh/only-export-components` lint rule (a component file may only export components) -- the same pattern already established elsewhere in this codebase (e.g. `getPasswordStrength` was previously split out of a component file for the same reason). `useFormatPreferences()` falls back to Nexali's pre-Part-6 defaults (USD/standard/mdy/browser timezone) rather than throwing when no provider is present, so isolated unit tests that render a component without the provider continue to work unchanged (confirmed: the full existing test suite passed with zero new provider wiring needed in any pre-existing test file).

### 38.13 Query-key / invalidation changes (Part N, timezone invalidation)

No new query keys were needed for formatting preferences themselves -- they are read directly off the existing `qk.profile(userId)` cache via the new context, not cached separately. `useUpdateProfile`'s mutation now branches on whether `timezone` is present in the update payload:

- **Timezone changed:** invalidates `qk.profile`, `qk.dashboardSummary`, `qk.reportsSummaryRoot`, `qk.budgetsProgressRoot`, and `qk.activitySummaryRoot` -- every cache whose SQL derives real financial-period boundaries from `profiles.timezone` (Backend Parts 4/5). Deliberately excludes `qk.categoryCounts` (all-time, filter-independent, no date-boundary logic at all -- Backend Part 5) and `qk.txRoot` (a previously-selected date-range filter's cached results were correct for whatever timezone was in effect when the selection was made; a new selection picks up the new timezone naturally with nothing to invalidate).
- **Currency/date_format/number_format changed (timezone unchanged):** invalidates only `qk.profile` -- confirmed directly (not assumed) with a real-`QueryClient` test: the financial aggregate caches are NOT touched, since the underlying numbers/periods they hold are unaffected by a display-only preference change; the UI simply re-renders under the new preference from data already in the (unrefetched) cache.

Verified with a dedicated test file, `src/features/profiles/useProfile.test.tsx`, exercising the real `useUpdateProfile` hook (not mocked) against a real `QueryClient` with a spied `invalidateQueries`.

### 38.14 Security (Part P)

No new RPC, no new table, no `SECURITY DEFINER` function was added or needed. All six new columns belong to `profiles`, already RLS-protected by the existing `Users can view/update their own profile` policies (`auth.uid() = id`), confirmed still correctly scoping every update through the unchanged `supabase.from("profiles").update(vars).eq("id", userId)` path -- `userId` is always the authenticated user's own id from `useUserInfo()`'s context, never client-form-supplied, so user A cannot update user B's preferences.

### 38.15 Generated types / query keys (Part F)

`src/types/database.types.ts`'s `profiles` Row/Insert/Update all gained the six new fields (no `any`). New: `src/lib/dateFormat.ts` (`DateFormatPref`, `formatDate`), `src/lib/preferenceOptions.ts` (shared `CURRENCY_OPTIONS`/`DATE_FORMAT_OPTIONS`/`NUMBER_FORMAT_OPTIONS` + label helpers, imported by both Profile and Settings so the two pages can never show different labels for the same stored code). `src/lib/format.ts`'s `formatCurrency` gained a `NumberFormatPref`-typed third parameter (previously a raw `locale` string -- safe, since no existing call site ever passed a third argument).

### 38.16 Tests added/updated

New: `src/lib/dateFormat.test.ts`, `src/lib/preferenceOptions` covered indirectly via Profile/Settings tests, `src/features/profiles/useProfile.test.tsx` (timezone vs. display-preference invalidation, §38.13). Rewritten: `src/lib/format.test.ts` (new signature, currency+number-format interaction matrix, explicit no-FX-conversion test), `src/pages/Profile.test.tsx` (+13 new cases for phone/location/bio persistence, dirty state, discard, save/failure, real currency summary), `src/pages/Settings.test.tsx` (+9 new cases for real currency/date/number persistence, combined-save-in-one-mutation, full discard, pending-controls-excluded-from-dirty-state).

### 38.17 Quality gates (this Part)

`npm run test`: 55 files, 483 tests, all passing. `npm run lint`: 0 errors, 0 warnings. `npm run build`: succeeds (same pre-existing >500kB chunk-size warning, unrelated). `npx tsc -b --force`: 0 errors.

---

## 39. Backend Part 7 — Notifications Backend V1, Preferences, Real Feed, Budget Producer

**Status at start of this Part:** confirmed via `npx supabase migration list` that all ten migrations through `20260917000000_profile_settings_preferences.sql` (Backend Part 6) showed matching local/remote timestamps — deployed. **Status at end of this Part: implemented in the repository, NOT yet applied to the live database.**

### 39.1 Re-audit of the pre-existing frontend (Part A)

Confirmed by direct re-read, not assumed from a prior session: `src/pages/Notifications.tsx` held a permanently-empty `useState<NotificationItemData[]>([])` (never Lovable mock data), real filter tabs (`all | unread | financial | security | system | assistant`), real day-grouping (`today`/`yesterday`/`earlier` via `notificationDay()`), and real (but permanently inert) `markRead`/`dismiss`/`markAllRead` handlers operating on local state. `src/lib/notifications.ts`'s `NotificationType` union (`"financial" | "security" | "system" | "assistant"`) is the exact type set now enforced by the new table's CHECK constraint — no type was added or removed. `src/components/notifications/NotificationItem.tsx`'s props contract (`{notification, onMarkRead, onDismiss}`) and visual structure were preserved byte-for-byte; only `Notifications.tsx`'s data source changed. `src/pages/Settings.tsx`'s four notification rows (`Budget approaching limit` / `Budget exceeded` / `Monthly financial summary` / `Account and security notifications`, exact labels/descriptions) were re-confirmed unchanged from Part 6.

### 39.2 `notifications` schema (Part B/D/E)

New migration `supabase/migrations/20260918000000_notifications_schema.sql`:

| Column | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | NOT NULL | none | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `type` | `text` | NOT NULL | none | `IN ('financial','security','system','assistant')` |
| `title` | `text` | NOT NULL | none | — |
| `description` | `text` | NOT NULL | none | — |
| `action_href` | `text` | NULL | none | must start with `/` and not `//` (no open redirects) |
| `action_label` | `text` | NULL | none | present iff `action_href` present |
| `secondary_action_href` | `text` | NULL | none | same safety constraint |
| `secondary_action_label` | `text` | NULL | none | present iff `secondary_action_href` present |
| `dedupe_key` | `text` | NULL | none | `UNIQUE(user_id, dedupe_key)` — NULL values don't collide |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — |
| `read_at` | `timestamptz` | NULL | none | NULL = unread; `isRead` is derived, never a separate boolean |
| `dismissed_at` | `timestamptz` | NULL | none | NULL = in the active feed; dismissal is durable, not a DELETE |

No `metadata jsonb` column: nothing in the real frontend or the budget producer needs unstructured payload storage, so it was deliberately omitted rather than added speculatively (per the task's "inspect current frontend first, don't blindly add every example field" instruction).

**Indexes:** `notifications_feed_idx (user_id, created_at DESC) WHERE dismissed_at IS NULL` (the feed's real query shape) and `notifications_unread_idx (user_id) WHERE dismissed_at IS NULL AND read_at IS NULL` (the unread-count query shape) — both partial indexes matching the exact predicates the real queries use, no speculative extra index added.

**RLS:** `ENABLE ROW LEVEL SECURITY`; `SELECT`/`UPDATE` policies scoped to `auth.uid() = user_id`. **No INSERT or DELETE policy for authenticated users** — mark-read/mark-all-read/dismiss are all UPDATEs (`read_at`/`dismissed_at`), never INSERT/DELETE, so the UPDATE policy is sufficient for every real user-initiated mutation. All notification rows are written by SECURITY DEFINER producer functions (table owner, bypasses RLS by design — the same trusted-producer pattern as `handle_new_user()`) or `service_role`.

**GRANTs:** surgical, not the baseline schema's blanket `GRANT ALL ... TO anon, authenticated` — mirrors the explicit REVOKE/GRANT discipline established in `20260913000000_secure_delete_user_rpc.sql`. `authenticated` gets exactly `SELECT, UPDATE`; no INSERT, no DELETE, no grant to `anon` at all. This is a deliberate defense-in-depth layer beyond RLS: a browser holding only the anon/authenticated key can never fabricate ("You exceeded your budget") or erase its own notification history, even if a future RLS policy were ever misconfigured.

### 39.3 `notification_preferences` schema (Part C)

Same migration. One row per user:

| Column | Type | Default | Notes |
|---|---|---|---|
| `user_id` | `uuid` | none | PK, `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `budget_approaching` | `boolean` | `true` | backs "Budget approaching limit" |
| `budget_exceeded` | `boolean` | `true` | backs "Budget exceeded" |
| `monthly_summary` | `boolean` | `true` | backs "Monthly financial summary" |
| `account_security` | `boolean` | `true` | backs "Account and security notifications" |
| `created_at` / `updated_at` | `timestamptz` | `now()` | `updated_at` auto-touched on every UPDATE via a small `BEFORE UPDATE` trigger |

**Default decision (all four ON):** the pre-Part-7 Settings switches rendered unchecked, but that reflected the *absence* of any real backing value (every row was hard `disabled`/`checked={false}` regardless of intent) — there was no real preference to preserve. Budget/security alerts are conventionally opt-out (default-on) product behavior; defaulting to ON also matches Notifications' own pre-existing empty-state copy ("Budget alerts, security events... will show up here as they happen"), which already implied these are active-by-default categories.

A **separate table**, not more `profiles` columns, was used: these rows describe notification *delivery* behavior, not account identity, and don't need to be read by every page that shows a name/avatar the way `profiles` is.

**RLS:** `SELECT`/`UPDATE` scoped to `auth.uid() = user_id`, plus (unlike `notifications`) an owner-scoped **INSERT** policy — a defensive fallback only, since normal operation never requires the client to create its own row (see auto-creation below), but an upsert that can only ever create the caller's *own* row is harmless. GRANTs: `SELECT, INSERT, UPDATE` to `authenticated` (no DELETE — not needed; cascade-deleted on account deletion).

**Auto-creation (Part C "auto-creation" requirement):** `handle_new_user()` was extended (via `CREATE OR REPLACE`, a new migration — the historical migration that first defined it was not edited) to also `INSERT INTO notification_preferences (user_id)` alongside its existing `profiles` insert, so every new signup gets deterministic defaults for free. Existing users are backfilled once in the same migration via `INSERT ... SELECT ... LEFT JOIN ... WHERE preferences row IS NULL` — deterministic, no manual per-user step required, and safe to run even if some preference rows already existed (it only inserts missing ones).

### 39.4 `delete_user_everything` follow-up (Part D, account-deletion cascade)

New migration `supabase/migrations/20260918000050_delete_user_notifications_cleanup.sql`. Both new tables carry `ON DELETE CASCADE` to `auth.users`, so they would be cleaned up automatically once the delete-user Edge Function calls `admin.auth.admin.deleteUser()` — but that call happens *after* `delete_user_everything()` in the existing Edge Function (confirmed by reading `supabase/functions/delete-user/index.ts`), and `delete_user_everything()` explicitly deletes every other app table for `p_user_id` rather than depending on cascade timing. `notifications`/`notification_preferences` deletes were added to `delete_user_everything()` (via `CREATE OR REPLACE`, preserving the existing `service_role`-only guard and GRANT/REVOKE discipline unchanged) to match that same established, delete-order-independent discipline.

### 39.5 Budget approaching/exceeded producer (Part K/L, the only implemented producer)

New migration `supabase/migrations/20260918000100_budget_notification_producer.sql`.

**Classification (Part K):**
- **Budget approaching / Budget exceeded — (A) implemented now.** Nexali already has real `transactions`/`budgets`/`profiles.timezone` and timezone-aware period math (Backend Part 4's `budgets_progress()`); this is the one notification type genuinely buildable correctly today.
- **Monthly summary — (B) deferred, needs infrastructure.** See §39.6.
- **Account/security — (D) deferred, no reliable event source.** See §39.7.
- **Assistant — not a producer target this Part.** Aura backend doesn't exist yet (§21); the table's `type` CHECK already allows `'assistant'` so the frontend filter tab stays valid, but nothing writes that type.

**Threshold semantics — reconciled against the real, already-shipped `src/lib/budgetMath.ts` constants, not invented separately:** `BUDGET_WARNING_THRESHOLD = 0.75` and `isOverBudget = spent > amount` are the two lines the frontend already draws. The producer fires **"approaching"** on crossing into `ratio >= 0.75` and **"exceeded"** on crossing into `ratio > 1`. `BUDGET_CRITICAL_THRESHOLD = 0.95` has no corresponding notification type in the frontend's `NotificationType` union (only financial/security/system/assistant exist) and was correctly left unused by the producer. Approaching and exceeded are **independent** events, each separately preference-gated and separately dedupe-keyed — a budget that jumps from 50% to 120% spent in one transaction legitimately produces both notifications at once, since it crossed both lines.

**Idempotency:** `UNIQUE(user_id, dedupe_key)` on `notifications` + `INSERT ... ON CONFLICT DO NOTHING`. `dedupe_key` format: `budget:<budget_id>:<year>-<month>:approaching|exceeded` — embeds both the budget and the period, so (a) repeated transaction edits within one period never produce duplicate rows, and (b) a new period always gets a fresh chance to notify (different key entirely). **v1 policy is strict-once-per-period:** once a `(budget, period, type)` notification exists, it is never produced again in that period even if the user deletes the triggering transaction and re-exceeds later — no event-state machinery was built to support a second notification, per the task's explicitly-acceptable v1 policy. This is a documented decision, not an oversight.

**Trigger points:** `AFTER INSERT OR UPDATE` on `transactions` (re-evaluates the row's own category/period, timezone-converted via `profiles.timezone`) and `AFTER INSERT OR UPDATE` on `budgets` (a new budget, or a lowered amount, against a category that already has spend). **Deliberately no trigger on `transactions` DELETE:** removing/lowering spend can only ever decrease a budget's ratio, and notifications fire only on crossing *into* a threshold from below — a delete can never newly cross a threshold, so there is nothing for a delete trigger to detect (and the v1 dedupe policy above means it couldn't "un-notify" either way).

**Preference gating:** `evaluate_budget_notifications()` reads the user's real `notification_preferences` row and skips the corresponding INSERT entirely when the matching switch is off; if no preferences row exists at all (should not happen post-backfill/`handle_new_user()`), it fails safe and does not notify rather than inventing a default.

**Security:** `evaluate_budget_notifications(p_user_id, ...)` is `SECURITY DEFINER` and accepts `p_user_id` as a parameter — `EXECUTE` is revoked from `PUBLIC`/`anon`/`authenticated` and granted only to `service_role`, so a browser can never call it directly to force-generate notifications into another user's feed. It is invoked only via `PERFORM` from the two trigger functions, which run as their own owner (`postgres`) regardless of the triggering session's role, so the trigger chain itself needs no additional grant.

### 39.6 Monthly summary — deferred (Part M)

Confirmed via `supabase/config.toml` (grepped for `cron|schedule`, zero matches) and `supabase/functions/` (only `delete-user` exists) that **no durable scheduling infrastructure exists in this project** — no `pg_cron`, no Supabase Scheduled Functions. Per the task's explicit instruction, this was **not faked** with an in-browser "check if the month ended" hack. The `monthly_summary` preference column exists and is fully persisted/editable in Settings today, but **no producer writes a monthly-summary notification in this Part.** Recommended for a future part once real scheduling infrastructure is provisioned.

### 39.7 Account/security notifications — deferred (Part N)

No reliable, already-observable event source exists in the current Supabase architecture for "new device sign-in" or "suspicious login" — building a real producer would require auth-provider webhook/session-event plumbing that does not exist yet. Account **deletion** is the one account/security event Nexali can currently observe reliably (via the `delete-user` Edge Function), but by the time it fires the user's row (and their notification feed with it) is being deleted, so there is no meaningful "you'll receive a notification" moment to hook. The `account_security` preference column exists and is fully persisted/editable in Settings today, but **no producer writes a security notification in this Part** — consistent with the task's explicit prohibition on fabricating security events the app cannot actually detect.

### 39.8 Real data-access layer (Part F)

New `src/lib/notificationsData.ts`: `listNotifications(userId, filter)` (server-filtered by tab — `unread` via `read_at IS NULL`, a type tab via `eq("type", ...)`, `all` unfiltered — always excluding dismissed, ordered `created_at DESC`, bounded to a fixed `FEED_LIMIT = 50`), `getUnreadNotificationCount(userId)` (a real `head: true, count: "exact"` query, never fetch-all-then-count), `markNotificationRead`/`markAllNotificationsRead`/`dismissNotification` (owner-scoped UPDATEs, belt-and-suspenders `.eq("user_id", userId)` alongside RLS), `getNotificationPreferences`/`updateNotificationPreferences` (the latter an owner-scoped `upsert`, using the defensive INSERT policy from §39.3). New `src/features/notifications/useNotifications.ts`: TanStack Query hooks for all of the above, with mark-read/mark-all/dismiss each invalidating both the feed (`qk.notificationsRoot`, a prefix covering every cached filter tab) and the unread count together, so the two can never drift out of sync (Part Q).

**Feed bounding (Part F "list query" requirement):** the real Notifications page has no pagination UI (no "load more", no page numbers), so a fixed "latest 50 non-dismissed" window is the correct match for what the frontend actually renders — documented in code as a deliberate v1 limitation, not a silent one: older notifications beyond the window remain in the database (never deleted) but aren't currently reachable from the UI; a future pagination affordance would be a frontend change, out of scope here.

**Icon mapping (an open design question from investigation, now resolved):** `NotificationItemData.icon: LucideIcon` is a non-serializable React component reference that cannot be stored in the database. `src/lib/notifications.ts` gained `notificationTypeIcon: Record<NotificationType, LucideIcon>` (financial → `TrendingUp`, security → `ShieldAlert`, system → `Info`, assistant → `Sparkles`, the last matching Aura's existing icon elsewhere in the app), and `notificationsData.ts`'s row-mapping function applies it — `NotificationItem.tsx`'s props contract and its existing tests needed zero changes.

### 39.9 Notifications page (Part G/H/I/R/S)

`src/pages/Notifications.tsx` rewritten to consume the real hooks; **visual structure (heading, filter tabs, day-grouping, empty-state copy) is byte-for-byte unchanged** from the pre-backend version — only the data source and loading/error states are new. New `src/components/notifications/NotificationsSkeleton.tsx` (shaped like the real feed, matching the existing `BudgetsSkeleton`/`DashboardSkeleton` pattern). Real `ErrorState` + Retry wired to the feed query's own `refetch`. The header's unread count reads from the independent `useUnreadNotificationCount` query (a real server count), not derived from the currently-filtered/visible list, so switching tabs never changes the header count. Mark-read/dismiss/mark-all-read all call the real mutations by id; a real zero-notification feed shows the existing truthful empty state with no seeded/demo rows.

### 39.10 Settings page (Part J)

The four notification switches (`src/pages/Settings.tsx`) converted from `disabled checked={false}` with a "Coming soon" caption to real, enabled, two-way-bound `Switch` controls, loaded from `useNotificationPreferences` and folded into the page's existing single `FormState`/dirty-state/Save-Discard machinery (the same architecture Backend Part 6 used for currency/date/number-format) — **integrated into the existing one-Save flow**, not an auto-save-per-switch model, matching the page's pre-existing interaction model. Discard restores all eight real fields (four profile + four preference) together in one assignment. The "Coming soon" caption was removed from exactly these four rows; Reduce animations/Show chart values/Appearance theme keep their pending captions unchanged (still no backing implementation, confirmed by re-inspection).

**Superseded by §39.10a below:** `handleSave` originally ran `updateProfile.mutateAsync(...)` and `updatePreferences.mutateAsync(...)` together via `Promise.all` — two independent database writes. That was a genuine correctness bug (non-atomic: one write could succeed while the other failed, silently leaving Settings partially persisted despite the UI reporting "Save failed") and was fixed within this same Part before approval; see §39.10a.

### 39.10a Atomic Settings save fix — `update_user_settings` RPC (post-review correctness fix, same Part)

**The bug:** `Promise.all([updateProfile.mutateAsync(...), updatePreferences.mutateAsync(...)])` issued two independent PostgREST requests. If one succeeded and the other failed, Settings correctly showed "Save failed" and preserved the user's local edits — but part of the change had already been permanently committed to the database, violating the single "Save Changes" action's implied all-or-nothing semantics.

**The fix:** new migration `supabase/migrations/20260918000200_atomic_settings_update.sql` defines `public.update_user_settings(p_timezone, p_currency, p_date_format, p_number_format, p_budget_approaching, p_budget_exceeded, p_monthly_summary, p_account_security)` — one `plpgsql` function, `SECURITY INVOKER`, updating both `profiles` and `notification_preferences` in the single implicit transaction a PL/pgSQL function call already gets. No explicit `BEGIN`/`COMMIT` and no internal `EXCEPTION WHEN` handler exists in the function body (verified by `src/features/settings/atomicSettingsMigration.test.ts`, which statically asserts this) — if either write fails, the `RAISE EXCEPTION` (or the unhandled constraint violation) propagates out of the whole function call, and PostgreSQL rolls back every change from that call, including the other table's otherwise-successful write.

**Security:** identity is derived exclusively from `auth.uid()` — the function accepts no `p_user_id` (or any other client-supplied identity) parameter at all, so it can never be asked to act on another user's row. `SECURITY INVOKER` (not `DEFINER`) means both writes run under the *calling* user's own privileges, so the existing RLS policies (`profiles`: `auth.uid() = id`; `notification_preferences`: `auth.uid() = user_id`) are what actually restrict each row — the function's own `WHERE id = v_uid` / `v_uid` insert value are belt-and-suspenders on top of that, not the sole protection. `auth.uid() IS NULL` fails safely via `RAISE EXCEPTION` rather than silently no-op-ing. `EXECUTE` is revoked from `PUBLIC` and granted only to `authenticated` (no `anon`), matching the exact `dashboard_summary`/`reports_summary`/`budgets_progress` SECURITY-INVOKER-RPC pattern from Backend Parts 4/5. Every enum-like value (`timezone` via `is_valid_tz`, `currency`/`date_format`/`number_format` via explicit `<> ALL (ARRAY[...])` checks matching their real CHECK constraints) is validated before either write, with a descriptive `RAISE EXCEPTION` on failure.

**Scope:** updates exactly `profiles.timezone/currency/date_format/number_format` and `notification_preferences.budget_approaching/budget_exceeded/monthly_summary/account_security` — no other `profiles` column (`phone`/`location`/`financial_bio`/`full_name`/`avatar_url`/`budget_reset_cycle`/`reset_day`) is touched by this function. The `notification_preferences` write is an owner-scoped `INSERT ... ON CONFLICT (user_id) DO UPDATE` — normal operation is the UPDATE branch (the Part 7 schema migration's `handle_new_user()` extension + backfill already guarantee a row exists for every user), with the INSERT branch as a defensive fallback that can only ever create the caller's *own* row.

**Frontend:** new `src/lib/settings.ts` (`updateUserSettings()`, the raw `supabase.rpc("update_user_settings", {...})` call) and `src/features/settings/useUpdateUserSettings.ts` (the TanStack Query mutation hook). `Settings.tsx`'s `handleSave` now calls this ONE mutation instead of the two independent ones; `isSaving`/dirty-state/Save/Discard/success-banner/failure-banner behavior is otherwise unchanged. The now-unused `useUpdateNotificationPreferences` hook (the mechanism of the original bug) was removed from `src/features/notifications/useNotifications.ts` rather than left as an unused, reintroducible non-atomic path; `useUpdateProfile` (Profile page's own, separate, still-non-atomic-by-design save path for identity fields) was **not** touched.

**Cache invalidation:** `useUpdateUserSettings` takes the mutation variables plus a `previousTimezone` (Settings' `saved.timezone` at save time) and, on success, always invalidates `qk.profile(userId)` and `qk.notificationPreferences(userId)`; it additionally invalidates `qk.dashboardSummary`/`qk.reportsSummaryRoot`/`qk.budgetsProgressRoot`/`qk.activitySummaryRoot` **only** when `vars.timezone !== previousTimezone` — the exact same timezone-vs-display-only split Backend Part 6 established for `useUpdateProfile`, now re-verified against the new hook with a dedicated real-`QueryClient` test suite (`src/features/settings/useUpdateUserSettings.test.tsx`).

### 39.11 AppNav / mobile unread indicator (Part P)

Direct inspection of `src/components/shell/AppNav.tsx`, `src/components/shell/MobileProfileMenu.tsx`, `MobileHeader.tsx`, and `MobileNav.tsx` confirmed **no existing badge/dot/count markup anywhere** in any of them — the desktop bell is a plain icon `<Link>`, the mobile Notifications entry is a plain `DropdownMenuItem` inside the avatar menu (no standalone mobile bell, consistent with the app's existing mobile-nav design). Per the task's explicit fallback instruction ("if there is no approved unread visual treatment, leave the bell visually unchanged"), **no badge was added to either** — inventing one would have been a nav redesign, out of scope. The Notifications page's own header subtitle still shows the real server-computed unread count (§39.9).

### 39.12 Database types (Part T)

`src/types/database.types.ts` gained `notifications` and `notification_preferences` Row/Insert/Update types (exact columns from §39.2/39.3, no `any`) and an `evaluate_budget_notifications` Functions entry (for schema completeness; it is not client-callable — see §39.5's GRANT discussion).

### 39.13 Tests added/updated (Part U)

New `src/lib/notificationsData.test.ts` (chained-builder-mocked `supabase.from`, covering: feed scoping/ordering/bounding/type-and-unread filtering, row→`NotificationItemData` mapping including icon derivation, empty-result and real-error handling for every function, unread-count query shape, mark-one/mark-all/dismiss owner-scoping, preferences read with a defense-in-depth default fallback, preferences upsert). Rewritten `src/pages/Notifications.test.tsx` (16 cases: loading skeleton, retryable error + real `refetch` wiring, truthful empty state, real server-sourced unread count independent of the visible list, real notification rendering, day-grouping, mark-read/dismiss/mark-all-read call the real mutations with the correct id, server-filtered tab switching, no Lovable mock content, real filter tabs, unread-tab empty-state copy). Rewritten `src/pages/Settings.test.tsx` (+ new "Notification preferences" and "Atomic save via update_user_settings RPC" describe blocks: real enabled switches, mixed on/off loading, toggling affects dirty state, discard restores prior value, exactly ONE mutation call per save, the RPC payload's exact eight-field shape, no client-supplied user id anywhere in the payload, a failed save preserves every local edit — timezone AND currency together, not just one — and never reports success). `NotificationItem.test.tsx` required **zero changes** — its props contract was preserved exactly.

New `src/features/settings/useUpdateUserSettings.test.tsx` (real-`QueryClient`, mocked `supabase.rpc`: exactly one RPC call per save, the exact `p_*`-named payload, no user-id argument, real error propagation, `qk.profile`/`qk.notificationPreferences` always invalidated on success, the four financial-aggregate caches invalidated only when `timezone !== previousTimezone`, and explicitly NOT invalidated for a currency-only or notification-preference-only change — mirroring `useProfile.test.tsx`'s existing timezone-invalidation test shape exactly). New `src/features/settings/atomicSettingsMigration.test.ts` — real SQL integration testing (a live Postgres wired to Vitest, asserting an actual rollback) is not available in this repository's test environment, so per the task's own fallback instruction this suite statically verifies the migration file instead: exactly one `update_user_settings` function definition, `SECURITY INVOKER` not `DEFINER`, `auth.uid()`-derived identity with no `p_user_id` parameter, a safe fail (`RAISE EXCEPTION`) on a null caller, both the `profiles` UPDATE and the `notification_preferences` upsert present inside the SAME function body, **no internal `EXCEPTION WHEN` handler** (which would otherwise let one write's failure be caught and the other still commit — exactly the bug being fixed), enum-value validation present, and the exact `authenticated`-only/no-`anon` GRANT shape.

### 39.14 Security summary (Part D, insert-security emphasis)

No client-facing path can ever INSERT a `notifications` row (no INSERT grant/policy for `authenticated`) or fabricate another user's notification (the one parameterized producer function, `evaluate_budget_notifications`, has `EXECUTE` restricted to `service_role` only). Every real user-initiated mutation (mark-read, mark-all-read, dismiss) is an UPDATE scoped by both RLS (`auth.uid() = user_id`) and an explicit `.eq("user_id", userId)` in the query itself — belt-and-suspenders, matching the codebase's established pattern. `action_href`/`secondary_action_href` are CHECK-constrained to internal relative routes (`/...`, never `//...`), preventing any stored notification from becoming an open redirect. Anon has no grant on either new table at all.

### 39.15 Confirmations

Frontend visual design unchanged (Notifications gained real loading/error/data states using its existing visual language only; Settings' four switches became enabled with no layout change). No fake/seeded notifications were added anywhere, including in the migration itself — existing users begin with a real empty feed. No real financial records were manually changed. No historical migration file was edited — `delete_user_everything` and `handle_new_user` were both updated via `CREATE OR REPLACE` in new migrations, exactly matching the pattern already established in Backend Part 2. Migrations were **not** applied to the live database — `npx supabase db push` was not run.

### 39.16 Quality gates (this Part, including the atomic-save fix)

`npm run test`: 59 files, 534 tests, all passing. `npm run lint`: 0 errors, 0 warnings. `npm run build`: succeeds (same pre-existing >500kB chunk-size warning, unrelated to this Part). `npx tsc -b --force`: 0 errors.

## 40. Post-Backend-Part-7 Financial Correctness Fix — Budget Spend Always Displaying $0

**Symptom:** Budget progress displayed $0 spent even when matching expense transactions existed.

**Example:** September 2026 "Food And Dining" budget = $250; a real Wendy's expense = $25. Expected progress: $25 spent / $225 remaining / 10%. Actual: $0 spent / $250 remaining / 0%.

**Root cause:** `src/lib/budgets.ts`'s `getBudgets()` omitted the flat `category_id` column from its Supabase `.select()`. The query selected `id, amount, month, year, categories:categories!budgets_category_id_fkey(id, name)`, but downstream spend-lookup calculations expected `budget.category_id` directly.

**Runtime effect:** `category_id` was `undefined` on every returned budget row despite the `Budget` TypeScript type claiming it always existed, because of a forced `as Budget[]` cast that hid the mismatch from the type checker. Every consumer's spend lookup (`spendByCategory.get(b.category_id ?? -1)`) therefore fell through to the `-1` fallback key, which never matches a real category id — so budget progress resolved to zero everywhere, for every budget, not just this one.

**Scope affected:** Budgets page, Dashboard's budget snapshot, and Reports' budget comparison/performance section — every one of them derives spend from the same `getBudgets()`-sourced `Budget[]` rows.

**Backend verification:** `budgets_progress()` was already correct — confirmed via live, read-only introspection of the deployed function (matches its migration exactly) and by invoking it directly for the affected user: for September 2026 it returned `category_id 31, spent 25`.

**Category verification:** transaction `category_id = 31`; budget `category_id = 31` — an exact match. No duplicate "Food And Dining" category existed (confirmed via a case-insensitive name query returning exactly one row).

**Timezone verification:** `America/Los_Angeles` period boundaries (`2026-09-01 00:00` through `2026-10-01 00:00` local) were correct; the transaction's `occurred_at` fell inside September 2026 in that timezone.

**Fix:** added `category_id` to `getBudgets()`'s Supabase select. No other application code was changed.

**Migration:** none required — `category_id` was already a real, RLS-readable column on `public.budgets`; this was purely a client-side query-shape bug.

**Notifications:** Backend Part 7's budget notification producers (`evaluate_budget_notifications()`) were not affected, because they run entirely server-side and query real `category_id` values directly via SQL — never through the frontend's `getBudgets()` function.

**Regression coverage:** new `src/lib/budgets.test.ts` and `src/features/budgets/useBudgetsForPeriod.integration.test.tsx`, proving: `category_id` is fetched by the real select; same-category spend contributes to that budget; spend for an unrelated category does not leak in; a budget in a different period correctly shows zero (not the bug's silent zero); and a fresh `QueryClient` (hard-reload simulation) produces the same correct result.

**Quality gates:** `npm run test` — 548 tests passing. `npm run lint` — clean. `npm run build` — successful. `npx tsc -b --force` — clean.

## 41. Recommended Backend Part 8 (superseded — see §42)

§41 recommended Aura backend as the natural next phase per the pre-existing sequence plan (§31). Instead, per explicit instruction, the **real Friends backend** was built next (§42) — Aura remains on hold, not started.

## 42. Backend Part 8 — Friends Backend (Real Schema, RPCs, Notifications Integration)

**Status at start of this Part:** confirmed via `npx supabase migration list` that all 14 migrations through `20260918000200_atomic_settings_update.sql` (Backend Part 7's atomic Settings fix) showed matching local/remote timestamps — deployed, nothing unexpectedly missing. `git status` was clean (the prior Friends-frontend-refinement work had already been committed). **Status at end of this Part: implemented in the repository, NOT yet applied to the live database.**

The Friends **frontend** (search, send/accept/decline, friends list, nav badges) had already been built and approved in a prior, frontend-only phase against `MOCK_USERS` and local component state. This Part replaces that mock layer with a real, secure Supabase-backed data model and connects the already-approved UI to it — no redesign of the Friends page, Notifications page, or navigation.

### 42.1 Data model — `friend_requests` and `friendships`

New migration `supabase/migrations/20260919000000_friends_schema.sql`. No duplicate user-profile table — identity comes entirely from `auth.users`/`public.profiles`.

`public.friend_requests`:

| Column | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `sender_id` | `uuid` | NOT NULL | none | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `recipient_id` | `uuid` | NOT NULL | none | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `status` | `text` | NOT NULL | `'pending'` | `IN ('pending','accepted','declined')` — no cancelled/blocking states |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — |
| `responded_at` | `timestamptz` | NULL | none | set the instant the recipient accepts/declines |

Plus `CHECK (sender_id <> recipient_id)` — self-requests are rejected at the database level, not only by the RPC's own pre-check.

`public.friendships`:

| Column | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `user_one_id` | `uuid` | NOT NULL | none | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `user_two_id` | `uuid` | NOT NULL | none | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | — |

Plus `CHECK (user_one_id <> user_two_id)`, `CHECK (user_one_id < user_two_id)` (canonical ordering), and `UNIQUE (user_one_id, user_two_id)` — one canonical row per accepted pair, never two mirrored rows.

### 42.2 Canonical-pair strategy and race-condition-proof uniqueness

Every writer (search/send/accept/remove) computes `LEAST(a, b)`/`GREATEST(a, b)` before touching `friendships`, rather than trusting caller-supplied ordering; the `friendships_canonical_order` CHECK (`user_one_id < user_two_id`) is the real backstop — an insert with the pair "backwards" fails the CHECK instead of silently creating a duplicate mirrored row.

Symmetric pending-request uniqueness (A→B pending and B→A pending must never coexist) is enforced by a **partial unique index**, not application logic alone:

```sql
CREATE UNIQUE INDEX "friend_requests_pending_pair_uidx"
    ON "public"."friend_requests" (LEAST("sender_id", "recipient_id"), GREATEST("sender_id", "recipient_id"))
    WHERE ("status" = 'pending');
```

This is the actual race-condition-proof enforcement: two concurrent `send_friend_request` calls for the same pair (double-click, two tabs, a genuine simultaneous mutual request) both attempt an insert, and the second fails atomically at the database level on `unique_violation` — `send_friend_request()` catches this specific exception and converts it to a friendly, safe error message (§42.5) rather than exposing a raw constraint-violation string. `send_friend_request()` also runs an explicit pre-check for the ordinary, non-racing case, so the common path gets an exact, specific error ("already pending" vs. "they already sent you one") — but the pre-check is a UX nicety; the unique index is what actually prevents the duplicate.

### 42.3 Indexes

Only for real access patterns, no speculative extra indexing: `friend_requests_pending_recipient_idx (recipient_id, created_at DESC) WHERE status='pending'` (incoming list/count), `friend_requests_pending_sender_idx (sender_id) WHERE status='pending'` (send's own pending-outgoing pre-check), `friendships_user_one_idx`/`friendships_user_two_idx` (list_friends/remove_friend/search's "friendships containing current user" lookup, since the user can be in either column), plus the two uniqueness indexes from §42.1/42.2.

### 42.4 RLS and grants — RPC-only surface

Both tables have `ENABLE ROW LEVEL SECURITY` and a defensive-in-depth SELECT-own-involved-rows policy — but **no direct table grant to `authenticated` at all**. `REVOKE ALL ... FROM PUBLIC`; `GRANT ALL ... TO service_role` only. Every real read (search, list friends, list/count incoming requests) and every mutation (send/accept/decline/remove) goes through a `SECURITY DEFINER` RPC, which bypasses RLS as the table owner regardless of the caller's own (nonexistent) table grants — so the closed surface never blocks a legitimate RPC call. This was chosen explicitly over granting `SELECT` on `friend_requests` to enable a PostgREST nested embed for the Notifications page's sender lookup: PostgREST cannot auto-embed `friend_requests → profiles` (no direct FK between them — both instead reference `auth.users`), so that alternative wouldn't have worked cleanly anyway; the Notifications-page sender lookup is solved by cross-referencing against the already-fetched `list_incoming_friend_requests()` result instead (§42.8).

profiles' live SELECT policy was re-confirmed via read-only introspection to be strictly `auth.uid() = id` — no broader read policy exists — which is *why* a SECURITY DEFINER function is required for any cross-user profile read here, not merely a stylistic choice.

### 42.5 RPC architecture (8 functions)

New migration `supabase/migrations/20260919000200_friends_rpcs.sql`. Every function: identity derived only from `auth.uid()` (no function accepts a caller-id parameter), rejects `auth.uid() IS NULL` with a real `RAISE EXCEPTION`, `SET search_path TO 'public', 'pg_temp'`, every table reference schema-qualified, `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated` only (no `anon` grant on any of the 8).

- **`search_nexali_users(p_query text)`** — bounded, privacy-safe search. Returns `user_id, full_name, avatar_url, email, relationship_status`. **Email privacy is proven in SQL, not merely hidden by React**: `email` is a `CASE WHEN lower(trim(email)) = lower(trim(p_query)) THEN email ELSE NULL END` expression — a non-exact-match row's email is genuinely absent from the PostgREST response, not a value the client chooses not to render. Name matching uses `strpos(lower(full_name), lower(query)) > 0` (a literal substring check), never `ILIKE`/`LIKE` with the raw query interpolated — this is what makes `%`/`_` in the query inert (no pattern-matching semantics at all), so a full-directory dump via wildcard injection is structurally impossible. Below the 2-character minimum, returns zero rows rather than raising (a still-typing user isn't an error). `LIMIT 20`. Self-excluded via `WHERE p.id <> auth.uid()` — never a client-supplied id to omit. `relationship_status` is one of `none | outgoing_pending | incoming_pending | friends`, computed via `LEFT JOIN`s against both tables.
- **`list_friends()`** — accepted friends only, includes email (allowed — the relationship is mutually accepted), ordered by full name ascending for a stable, predictable list.
- **`list_incoming_friend_requests()`** — pending requests where `recipient_id = auth.uid()`. Deliberately never selects the sender's email anywhere in the function, matching the "incoming request shows full name + avatar only" rule at the server.
- **`get_incoming_friend_request_count()`** — a real `count(*)` query (backed by `friend_requests_pending_recipient_idx`), never a fetch-all-then-count. This is the Friends badge's real data source (§42.9).
- **`send_friend_request(p_recipient_id uuid)`** — atomically creates the `friend_requests` row AND the recipient's real Notifications-backend notification, inside one function call's implicit transaction. Pre-checks (in order): self-request, missing/nonexistent recipient, already-friends, existing pending in either direction. **Reverse-pending (B already asked A) does not auto-create or auto-accept** — it raises a distinct, safe error ("This user already sent you a friend request — check your incoming requests") so the frontend can reflect `incoming_pending` and point the user at Accept/Decline instead. A `unique_violation` exception handler is the real race-condition backstop (§42.2). Returns the new request's `uuid`.
- **`accept_friend_request(p_request_id uuid)`** — `SELECT ... FOR UPDATE` row-locks the target request (so a concurrent accept/decline on the same request serializes instead of racing), validates the caller is the recipient, is **idempotent** on an already-accepted request (safe no-op, not an error, never a duplicate friendship), creates the canonical friendship via `INSERT ... ON CONFLICT (user_one_id, user_two_id) DO NOTHING`, marks the request `accepted` + `responded_at`, and resolves (marks read + dismissed) the recipient's own associated notification — all in one transaction.
- **`decline_friend_request(p_request_id uuid)`** — mirrors accept exactly, minus friendship creation; never creates a friendship.
- **`remove_friend(p_friend_user_id uuid)`** — deletes exactly the one canonical friendship row (via `LEAST`/`GREATEST`), raises if nothing was deleted (`GET DIAGNOSTICS ... ROW_COUNT`). Never deletes profiles, accounts, or `friend_requests` history — declined/accepted requests are kept permanently as real history.

### 42.6 Notifications integration — reused, not duplicated

New migration `supabase/migrations/20260919000100_friends_notification_integration.sql`. This is a NEW forward migration — none of the deployed Part 7 migrations were edited.

- `notifications.type`'s CHECK constraint was **widened** (dropped and recreated) to add `'friend_request'` alongside the four existing values — a superset of the old constraint, so no existing row is affected.
- A new nullable `friend_request_id uuid REFERENCES public.friend_requests(id) ON DELETE SET NULL` column identifies which request a `friend_request`-typed notification is about — preferred over encoding the id in `description` or a jsonb blob (no `metadata` column exists on `notifications` at all, confirmed in Part 7). **`ON DELETE SET NULL`, not `CASCADE`**: a sender's account deletion cascades their own `friend_requests` rows, but the notification this column points to belongs to the *recipient* — a different, still-existing user — so the notification itself must survive; only the now-dangling reference is nulled.
- A supporting partial index, `notifications_friend_request_id_idx ... WHERE friend_request_id IS NOT NULL`.
- `send_friend_request()` reuses the established per-producer `dedupe_key` convention (`'friend-request:' || v_request_id::text`) for consistency, though the real duplicate-prevention backstop is the partial unique index on `friend_requests` (§42.2), not this key — `v_request_id` is freshly generated per call and can never collide across two different requests.
- **No new `notification_preferences` toggle was added** — friend-request notifications are always delivered in v1, a deliberate scope decision (documented here, not silently decided).
- **Filtering:** no new filter tab was added (`FILTER_TABS` in `Notifications.tsx` is a hand-written literal array, confirmed by direct inspection — extending the `NotificationType` union does not auto-create a tab). The existing **"System" tab's query was widened** to `type IN ('system', 'friend_request')` — the chosen v1 fold-in behavior, rather than a new, larger tab row.

### 42.7 Frontend data layer replacement

`MOCK_USERS`/frontend-only relationship persistence removed. `src/lib/friends.ts` trimmed to pure types (`FriendStatus`, `NexaliUserPreview` with `email: string | null` now documented as server-enforced-null, new `IncomingFriendRequest` type with no email field at all, `MIN_SEARCH_QUERY_LENGTH = 2`, `toSplitParticipant()` preserved unchanged for Split Expenses compatibility — see §42.11). The now-redundant client-side `isExactEmailMatch()` helper was removed along with its tests, since email privacy is now enforced server-side (§42.5).

New `src/lib/friendsData.ts` — thin, typed `supabase.rpc(...)` wrappers for all 8 RPCs, throwing the real Postgres error rather than swallowing it. New `src/features/friends/useFriendsQueries.ts` — TanStack Query hooks: `useSearchNexaliUsers` (debounced ~300ms via a new generic `src/shared/useDebouncedValue.ts` hook, `enabled` gated on a trimmed length ≥ 2), `useListFriends`, `useListIncomingFriendRequests`, `useIncomingFriendRequestCount`, and mutations `useSendFriendRequest`/`useAcceptFriendRequest`/`useDeclineFriendRequest`/`useRemoveFriend`.

New query keys in `src/features/querykeys.ts`: `friendsRoot(userId)`, `friendsList`, `friendsIncoming`, `friendsIncomingCount`, `friendsSearchRoot`, `friendsSearch(userId, query)`.

**Cache invalidation, exactly per mutation:**

| Mutation | Invalidates |
|---|---|
| `sendFriendRequest` | `friendsSearchRoot` only |
| `acceptFriendRequest` | `friendsList`, `friendsIncoming`, `friendsIncomingCount`, `friendsSearchRoot`, `notificationsRoot`, `notificationsUnreadCount` |
| `declineFriendRequest` | same as accept, minus `friendsList` (a decline never creates a friendship) |
| `removeFriend` | `friendsList`, `friendsSearchRoot` only |

None of the four ever invalidates Dashboard/Reports/Budgets/Transactions caches.

**Architectural simplification — the prior frontend-only phase's custom `FriendsProvider`/`friendsStore.ts`/`useFriends()` React Context was deleted.** It existed solely to share mock relationship state between the nav badges and the Friends page; now that the backend is real, TanStack Query's own cache (keyed by `qk.friendsIncomingCount(userId)`, etc.) already provides that same cross-component sharing with zero custom plumbing — exactly how the Notifications unread badge has always worked. `AppLayout.tsx`, `renderWithProviders.tsx`, `AppNav.tsx`, and `MobileHeader.tsx` were updated accordingly.

### 42.8 Friends page and Notifications page rewiring

`src/pages/Friends.tsx` rewritten to call the 4 query hooks + 4 mutation hooks directly (no context): Friend Requests section (hidden when empty), Find People search (`role="region" aria-label="Search results"`, loading/error+retry/no-results/results states, `showEmail={user.email != null}` now a pure server-truth check), Your Friends (loading/error+retry/empty/list with a Remove-Friend confirm dialog).

`src/pages/Notifications.tsx`: for each rendered notification, if `type === "friend_request"` and its `friendRequestId` matches an entry in the already-fetched `useListIncomingFriendRequests()` result, it renders the existing `FriendRequestNotificationCard` (wired to the real accept/decline mutations, per-request pending state) instead of the plain `NotificationItem`. This reuses rather than duplicates: any *visible* (non-dismissed) `friend_request` notification is, by construction, still pending — both `accept_friend_request()`/`decline_friend_request()` dismiss their notification atomically (§42.5) — so a matching entry exists in the normal case; if not (an edge case), the page falls back to the plain `NotificationItem` rather than crashing.

`src/lib/notifications.ts`'s `NotificationItemData` gained an additive `inlineActions?: NotificationInlineAction[]` field (`{label, onClick, variant?, disabled?}`), separate from the existing Link-based `primaryAction`/`secondaryAction` — Accept/Decline are real mutations, not navigation. `NotificationItem.tsx` renders these as real `<Button onClick>` elements. This extends the component architecture additively, in a typed way, without touching the real DB-bound `type`/action-href CHECK constraints.

### 42.9 Friends badge vs. Notifications badge — deliberately independent

The Friends nav badge (`AppNav.tsx`/`MobileHeader.tsx`) is sourced from `get_incoming_friend_request_count()` (§42.5) via `qk.friendsIncomingCount`, not from the Notifications unread count. This is intentional: a manually-dismissed `friend_request` notification decreases the Notifications unread badge, but the underlying friend request is still pending, so the Friends badge must not decrease with it. The two badges can legitimately disagree, and that disagreement is correct, not a bug.

### 42.10 Account deletion cleanup

New migration `supabase/migrations/20260919000300_delete_user_everything_friends_cleanup.sql` extends `delete_user_everything()` (via `CREATE OR REPLACE`, preserving the existing `service_role`-only guard/REVOKE/GRANT discipline unchanged) with explicit deletes for `friend_requests` (either `sender_id` or `recipient_id`) and `friendships` (either column) — matching the same delete-order-independent discipline already established for `notifications`/`notification_preferences` in Part 7, even though both new tables already carry `ON DELETE CASCADE` to `auth.users` and would be cleaned up by cascade alone once the Edge Function's `auth.admin.deleteUser()` call runs.

### 42.11 Split Expenses compatibility

Not wired into Friends yet, per instruction. `toSplitParticipant(user: NexaliUserPreview): Participant` was preserved unchanged in `src/lib/friends.ts` — no type adjustment was needed; `NexaliUserPreview`'s shape (`id/fullName/email/avatarUrl/status`) did not change in a way that affects this conversion.

### 42.12 Database types

`src/types/database.types.ts`: `notifications` Row/Insert/Update gained `friend_request_id: string | null` plus a `Relationships` entry to `friend_requests`; new full `friend_requests`/`friendships` table type blocks; 8 new `Functions` entries with exact Args/Returns shapes matching the SQL. No `any` used. Verified clean via `npx tsc -b --force` after each edit.

### 42.13 Race conditions — handled and tested

- **Simultaneous mutual requests (A→B and B→A at once):** the partial unique index (§42.2) allows only the first to commit; the second fails `unique_violation`, caught and converted to a safe error.
- **Double-click send:** same backstop — a duplicate insert for the same pending pair cannot commit.
- **Double-click accept / concurrent accept+decline in two tabs:** `SELECT ... FOR UPDATE` in both `accept_friend_request()`/`decline_friend_request()` serializes the two calls; the second sees the already-updated status and either idempotently no-ops (double-accept) or raises "no longer pending" (accept racing a decline, or vice versa) — never a duplicate friendship or a corrupted status.
- **Remove-while-stale-tab:** `remove_friend()` raises "You are not friends with this user" if the row is already gone (e.g. already removed from another tab) rather than silently succeeding on nothing.

Static verification of all of the above (the exact SQL shape of the row-lock, the idempotency branch, the unique-violation handler, the canonical-pair constraints) lives in `src/features/friends/friendsMigrations.test.ts` (§42.14) — real concurrent-session integration testing is not available in this repository's test environment (no local/CI Postgres wired to Vitest), the same documented limitation as Part 7's atomic-settings fix.

### 42.14 Tests added/updated

- `src/lib/friends.test.ts` — rewritten, now covers only `toSplitParticipant` (the search/exact-email logic moved server-side).
- `src/lib/friendsData.test.ts` (new) — every RPC wrapper's call shape, row mapping (including a real null email passed through untouched, never invented client-side), and real-error propagation.
- `src/features/friends/useFriendsQueries.test.tsx` (new) — debounce timing and the 2-character minimum gate (via fake timers against a real `QueryClient`), and each mutation's exact invalidation set (send/accept/decline/remove) against a real, spied `QueryClient.invalidateQueries`, mirroring `useUpdateUserSettings.test.tsx`'s established pattern.
- `src/features/friends/friendsMigrations.test.ts` (new) — static verification of all 4 migrations: self-request/self-friendship CHECKs, canonical-pair ordering/uniqueness, the partial unique pending-pair index, every RPC's `auth.uid()`-only identity/null-rejection/`SECURITY DEFINER`/search_path/REVOKE-GRANT shape, the email-privacy `CASE` expression, `strpos`-not-`ILIKE` name matching, the 2-character minimum and `LIMIT 20`, the reverse-pending no-auto-accept behavior, the `FOR UPDATE`/idempotency/canonical-insert shape of accept, decline's no-friendship-creation, remove's single-row delete, and the account-deletion migration's new deletes plus unchanged guard.
- `src/shared/useDebouncedValue.test.ts` (new) — immediate initial value, no update before the delay, update after the delay, and rapid-change collapsing into one final update.
- `src/components/shell/AppNav.test.tsx` / `MobileHeader.test.tsx` — rewritten to mock `useIncomingFriendRequestCount` (a count-query shape) instead of the deleted `useFriends`; badge loading/error tests added, mirroring the Notifications-badge test shape.
- `src/AppLayout.test.tsx` — rewritten to mock `src/lib/friendsData.ts` at the lowest layer (stateful mock implementations for accept/decline) and let the real hooks/`Friends` page run unmocked, proving genuine TanStack-Query-cache-based sharing between `AppNav`'s badge and the Friends page — no custom context.
- `src/pages/Friends.test.tsx` — fully rewritten (24 tests) against the real query/mutation hooks: friends-list/search loading and error+retry, the 2-character minimum gate, name-search hides email / exact-search shows email, send/accept/decline/remove each call the real mutation with the correct id, per-request pending-disable, status labels for outgoing/incoming/already-friends, the remove confirm-dialog flow including its error state.
- `src/pages/Notifications.test.tsx` — new "friend_request notifications" describe block: the actionable card renders with the sender's name and never their email, Accept/Decline call the real mutations with the request id, per-request pending-disable, a safe fallback when no matching incoming request is found, the System tab includes `friend_request` rows, and the unread count reflects a new `friend_request` notification like any other type.
- `src/components/notifications/NotificationItem.test.tsx` — new tests for the additive `inlineActions` rendering path: renders as real buttons (not links), each action's own `onClick`/`disabled` is independent of `onMarkRead`, multiple inline actions render correctly, and existing action-less notifications are unaffected.
- `src/lib/notificationsData.test.ts` — new tests: the System tab's query uses `.in("type", ["system","friend_request"])` (not `.eq("type","system")`), and `friend_request_id` maps through onto `NotificationItemData` (including the null case).

### 42.15 Security summary

`auth.users` is never exposed directly to the browser — no public view of all emails exists, and the one place `auth.users.email` is read (`search_nexali_users`/`list_friends`) is a narrowly-scoped `SECURITY DEFINER` function returning only the specific columns the frontend needs, with `email` itself null-gated by an exact-match `CASE` expression (§42.5). No service-role key is ever used in frontend code — `friendsData.ts` calls only `supabase.rpc(...)` through the normal anon/authenticated client, same as every other data-access module in this codebase. Both new tables have no direct `authenticated` grant at all (§42.4). Every RPC rejects a null `auth.uid()`, derives the caller exclusively from it, and has no `anon` grant.

### 42.16 Confirmations

Friends page, Notifications page, and navigation were not visually redesigned — only their data sources changed (loading/error states use each page's existing visual language). Split Expenses was not modified (§42.11). Aura was not started. No historical migration file was edited — `delete_user_everything` was updated via `CREATE OR REPLACE` in a new migration, matching the established pattern. Migrations were **not** applied to the live database — `npx supabase db push` was not run. No commit or push occurred.

### 42.17 Quality gates (this Part)

`npx tsc -b --force`: 0 errors. `npm run lint`: 0 errors, 0 warnings. `npm run build`: succeeds (same pre-existing >500kB chunk-size warning, unrelated to this Part). `npm run test` (`npx vitest run --maxWorkers=2`): 71 test files, 773 tests, all passing.

### 42.18 Known limitations (v1, documented)

- No realtime subscription: an incoming friend request from another user does not appear until the next refetch/navigation (the same polling-via-cache-invalidation model already used everywhere else in this codebase — no `supabase.channel()` realtime listener exists anywhere in the app yet).
- Friend request history (`friend_requests` rows) is retained forever; there is no UI to view past declined/expired requests — only the currently-pending incoming list is surfaced.
- No pagination on `list_friends()`/`search_nexali_users()` beyond the fixed `LIMIT 20` search bound; a user with a very large friends list has no "load more" affordance today (matches the same documented v1 limitation as the Part 7 Notifications feed's fixed 50-row window).
- Friend requests cannot be cancelled by the sender once sent (only accepted/declined by the recipient) — no "cancel" state exists in the status model, per the task's explicit instruction.

## 43. Post-Backend-Part-8 Connectivity Fix — `list_friends()`/`search_nexali_users()` Failing on Every Call

**Symptom:** `/friends` initially rendered, then "Your Friends" changed to "Couldn't load your friends" after a few seconds; searching for a real, existing account ("Jordan Van") showed "Couldn't search Nexali users." — not merely zero results.

**Root cause:** `auth.users.email` is declared `character varying(255)` (confirmed via `information_schema.columns`), but both `list_friends()` and `search_nexali_users()`'s `RETURNS TABLE` declares that column `email text`. PL/pgSQL's `RETURN QUERY` type-checks the query's output tuple descriptor against the declared return type before producing any rows, so both functions raised `ERROR 42804: structure of query does not match function result type` on every call — including for a user with zero friendships and zero search matches (not row-count-dependent). Reproduced live for both functions (see the dedicated Friends-connectivity-bug final report for the exact sanitized error text and reproduction method — a `SELECT ... FOR UPDATE`-free direct RPC call inside a rolled-back transaction, impersonating a real test user via `set_config('request.jwt.claim.sub', ...)`, never a real browser session).

**Ruled out (each independently verified against the live project):** migration deployment state (all 4 Friends migrations were deployed), RPC existence (all 8 present), function signatures (exact match to the frontend's `supabase.rpc(...)` argument names), `SECURITY DEFINER`/owner (`postgres`, matching the established pattern), `EXECUTE` grants to `authenticated` (present on all 8), `search_path` (pinned, all objects already schema-qualified), RLS (both tables have RLS enabled, irrelevant here since `SECURITY DEFINER` functions bypass it as the table owner), account state (test account B has both an `auth.users` row and a matching `public.profiles` row with `full_name = 'Jordan Van'` exactly), `friend_requests`/`friendships` table existence (both present, 0 rows — a valid state), and the Part 8 Notifications integration (type CHECK and `friend_request_id` column both correctly deployed). None of these contributed.

**Fix:** new migration `supabase/migrations/20260920000000_fix_friends_email_type_cast.sql` — `CREATE OR REPLACE` for both functions, reproduced byte-for-byte from their live `pg_get_functiondef()` output with a single addition: `u.email` → `u.email::text` at the two sites feeding the `email text` output column (the `CASE WHEN ... THEN u.email::text ELSE NULL END` privacy expression in `search_nexali_users()` is otherwise untouched — the exact-match condition, `strpos`-based name matching, 2-character minimum, `LIMIT 20`, self-exclusion, `SECURITY DEFINER`/`search_path`/grant discipline are all byte-identical to the deployed migration). The already-deployed `20260919000200_friends_rpcs.sql` was **not edited**.

**Verified before reporting as fixed:** the corrected function bodies were executed inside a `BEGIN ... ROLLBACK` transaction against the linked project (impersonating a real test user via `set_config`), proving `search_nexali_users('Jordan Van')` now succeeds and correctly returns the real B account (`email` correctly `NULL` for this non-exact-match name search — the privacy rule held) — then rolled back, so nothing was actually deployed.

**Retry-delay finding (separate, not itself a bug in this fix):** `src/main.tsx`'s real `QueryClient` uses zero custom `defaultOptions`, so it inherits TanStack Query v5's default `retry: 3` with exponential backoff (~1s/2s/4s, ~7s total) — applied even to a deterministic, non-transient PostgREST/Postgres error that will fail identically on every retry. This is why the error took several seconds to appear. **Not changed in this fix** (the task explicitly required the underlying error be fixed first); recommended as a follow-up once this migration is deployed — e.g. `retry: (failureCount, error) => ...only retry network-class failures...` for the Friends queries (and potentially app-wide).

**Migration status:** written to the repo, **not deployed** (`npx supabase migration list` confirms `20260920000000` shows local-only). Waiting for explicit approval before `npx supabase db push`.

**Regression coverage:** new `src/features/friends/friendsEmailTypeCastFix.test.ts` — static verification that both `::text` casts are present, the privacy `CASE` condition and every other column/behavior/security/grant is otherwise byte-identical to the deployed migration, and that the deployed `20260919000200_friends_rpcs.sql` itself remains untouched (still lacks the cast, proving this is a new forward-only file, not an edit).

**Quality gates:** `npm run test` — see the dedicated Friends-connectivity-bug final report for the exact count. `npm run lint` — clean. `npm run build` — successful. `npx tsc -b --force` — clean.

## 44. Split Expenses Backend

**Status at start of this Part:** confirmed via `npx supabase migration list` that all migrations through `20260920000000_fix_friends_email_type_cast.sql` showed matching local/remote timestamps — deployed, nothing unexpectedly missing; `git status` clean. **Status at end of this Part: implemented in the repository, NOT yet applied to the live database.**

The Split Expenses **frontend** (receipt cards, item assignment, Friend Autocomplete participant picker, settlement preview) had already been built and approved in prior, frontend-only phases against local component state only — no real backend existed, and Submit was a no-op placeholder. This Part adds the real backend and wires the already-approved Submit button to it; no visual redesign.

### 44.1 Scope boundary — no OCR/CSV/image work

Per explicit instruction, this Part does not implement receipt OCR, image processing, or CSV parsing of any kind — `SplitReceipt`/`SplitReceiptItem` (already defined in `src/lib/splitExpenses.ts` from the frontend-only phase) are treated as already-structured data. The expected normalized import shape is documented here as a TypeScript interface only, independent of whatever OCR/Excel/CSV provider eventually produces it:

```ts
interface NormalizedReceiptImport {
  merchant: string | null;
  purchaseDate: string;       // ISO yyyy-mm-dd
  items: { description: string; quantity: number; totalCents: number }[];
  extraRows?: { label: string; amountCents: number }[]; // tax/tip/fees/discounts — NOT split, see §44.10
  parsedTotalCents?: number;  // full receipt total, informational only
}
```

No file in this Part reads image bytes, calls an OCR API, or parses CSV text.

### 44.2 Data model — 7 tables

New migration `supabase/migrations/20260921000000_split_expenses_schema.sql`. Money is integer **cents** (`bigint`) in every Split-specific column — converted to `transactions.amount numeric(10,2)` only at the single point a real transaction row is created.

**`split_expenses`** — the parent submitted-split record.

| Column | Type | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `created_by` | uuid | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `currency` | text | `IN ('USD','EUR','GBP','CAD','AUD','JPY')` |
| `status` | text | `IN ('submitted','accepted','needs_attention')` |
| `idempotency_key` | uuid | NOT NULL |
| `created_at`, `submitted_at` | timestamptz | |

`UNIQUE(created_by, idempotency_key)` — the real, DB-level idempotency backstop (§44.11). Status is deliberately a 3-state model, not the 4-state model the task suggested (`submitted`/`partially_accepted`/`accepted`/`needs_attention`): no frontend surface distinguishes "nobody responded yet" from "some accepted, some pending" — both are just "not fully resolved", and the precise per-participant state is always separately available on `split_participants.response_status`.

**`split_participants`** — every Nexali user in the split, including the creator (an ordinary row, `response_status='accepted'` immediately — the creator never approves their own submission).

| Column | Type | Constraint |
|---|---|---|
| `split_id` | uuid | `REFERENCES split_expenses(id) ON DELETE CASCADE` |
| `user_id` | uuid | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `position` | int | submission-order, reused for deterministic settlement ordering |
| `response_status` | text | `IN ('pending','accepted','declined')` |
| `responded_at` | timestamptz | nullable |
| `allocated_total_cents`, `paid_total_cents` | bigint | `>= 0` |

`UNIQUE(split_id, user_id)` — the real identity used everywhere. "Payer belongs to this split" / "allocation belongs to this split" are validated **inside the RPCs**, not via a composite FK from `split_receipts`/`split_item_allocations` — see §44.3's payer-FK rationale.

**`split_receipts`** — one row per receipt (not embedded jsonb — item allocations need real per-row FKs).

| Column | Type | Constraint |
|---|---|---|
| `split_id` | uuid | CASCADE |
| `merchant` | text | nullable |
| `receipt_date` | date | NOT NULL |
| `category_id` | integer | `REFERENCES categories(id)` — no cascade/RESTRICT (categories are effectively immutable, no delete UI exists) |
| `receipt_total_cents` | bigint | `> 0` — SUM of item line totals; tax/tip/fee/discount are **not** split in v1 (§44.10) |
| `payer_user_id` | uuid | `REFERENCES auth.users(id) ON DELETE CASCADE` — plain FK, see §44.3 |
| `position` | int | |

**`split_receipt_items`** — normalized item lines. `assignment_type IN ('mine','someone_else','shared')` is descriptive/audit only — `split_item_allocations` is the authoritative per-participant share.

**`split_item_allocations`** — the AUTHORITATIVE, server-recomputed per-participant share of one item (never trusted from the client). `UNIQUE(item_id, user_id)`, `share_cents > 0`. "No participant outside the split may receive an allocation" is enforced by `submit_split_expense()`'s own validation (every id it allocates to comes from the already-validated participant set), not an extra DB constraint.

**`split_settlements`** — the authoritative, server-computed net settlement (documentation only — no external payment processing). `CHECK (from_user_id <> to_user_id)`, `amount_cents > 0`, `UNIQUE(split_id, from_user_id, to_user_id)`. `settled_at` is a nullable column reserved for a future "mark paid back" affordance — nothing in this Part sets it (no such workflow exists in the approved frontend).

**`split_generated_transactions`** — explicit provenance linking one real `transactions` row to the split/receipt/participant it was generated from. `UNIQUE(receipt_id, user_id)` — the real idempotency/duplicate-transaction backstop, never inferred from note text alone. `transaction_id integer REFERENCES transactions(id) ON DELETE CASCADE`.

Every table: RLS enabled, `REVOKE ALL FROM PUBLIC`, `GRANT ALL TO service_role` only — an RPC-only surface, matching the Friends backend's established architecture (§42.4). A defensive-in-depth SELECT policy exists on each table (§44.4) but is inert today since `authenticated` has no direct table grant at all.

### 44.3 The payer-FK design decision (composite FK rejected)

An earlier draft of the schema used a composite FK, `split_receipts.payer_user_id → split_participants(split_id, user_id)`, for a DB-level "payer must be a participant of this split" guarantee. This was rejected: a composite FK defaults to `NO ACTION` on delete, which would **block account deletion** (or any cleanup) for any user who was ever a receipt's payer — deleting their `split_participants` row would fail with a foreign-key violation while the receipt still referenced it. The final schema uses a plain `payer_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE` instead, with "payer belongs to this split" validated explicitly inside `submit_split_expense()` before any row is written — the same RPC-only-validation choice already made for `split_item_allocations.user_id`, for the identical reason. Documented as a v1 limitation in §44.16: if a payer's account is later deleted, that receipt (and its items/allocations) cascades away with it, even if other participants had already accepted and have real, untouched transactions for *other* receipts in the same split.

### 44.4 RLS recursion and its fix — the key architectural finding of this Part

`split_expenses`'s own SELECT policy needs to check "is the caller a participant?" (a `split_participants` lookup), and `split_participants`'s own policy needs to check "can the caller see this split?" (a `split_expenses` lookup). A naive first attempt — each policy embedding a raw cross-table `EXISTS` subquery against the other table — produced `ERROR 42P17: infinite recursion detected in policy for relation "split_expenses"` the moment either was evaluated for a non-RLS-exempt role. **This was discovered live**, not theorized in advance, while validating the migration inside a rolled-back transaction.

The fix is Supabase's own documented pattern for this exact class of bug: isolate the cross-table check inside a `SECURITY DEFINER STABLE` helper function, which evaluates without re-entering RLS on the table(s) it reads. Three helpers were added:

- `_can_view_split(p_split_id)` — `EXISTS(...created_by=auth.uid()) OR EXISTS(...split_participants...user_id=auth.uid())`.
- `_can_view_split_receipt(p_receipt_id)` — resolves the receipt's `split_id`, delegates to `_can_view_split`.
- `_can_view_split_item(p_item_id)` — resolves the item's receipt → split, delegates to `_can_view_split`.

Every policy on every Split table calls one of these three helpers; **no policy embeds a raw cross-table `EXISTS` subquery**. This required a specific file structure, also worth preserving on any future edit: all 7 tables created first (columns/constraints/indexes/RLS-enable/grants only), then the 3 helper functions, then all 7 `SELECT` policies at the very end — `CREATE POLICY` validates referenced objects immediately (unlike some deferred-validation constructs), so a forward reference to a not-yet-created table fails.

### 44.5 Participant authorization — never trusting the stale frontend Friends list

Every non-creator participant id in `submit_split_expense()`'s payload is re-validated against the **live** `friendships` table at submission time (`LEAST`/`GREATEST` canonical-pair lookup, §42.2's pattern) — never the frontend's possibly-stale in-memory Friends list. The creator is auto-included and auto-`accepted`; every other id must resolve to a real, currently-accepted friendship or the whole submission is rejected with a safe error. A friendship removed *after* a split was already submitted does not retroactively invalidate that split — the historical `split_participants`/`split_receipts`/etc. rows remain valid, and a participant may still `accept_split_expense`/`decline_split_expense` on an already-submitted split even if the friendship was removed in the interim (documented v1 rule, §44.16) — friendship validity is checked only at submission time, by design.

### 44.6 Payer semantics

Exactly one payer per receipt (v1, no split-payment support) — `split_receipts.payer_user_id`. Different receipts in the same split may have different payers, which is required for cross-receipt netting (§44.8) to be meaningful. The payer must belong to the split's participant set — validated inside `submit_split_expense()` (`v_payer = ANY(v_participant_ids)`), not via a DB constraint (§44.3).

### 44.7 Item allocation — server-authoritative, deterministic

`split_item_allocations` is computed **server-side**, from the raw `assignmentType`/`participantIds` the client sends per item — the client never sends, and the server never trusts, a client-computed `share_cents`. The equal-split distribution:

```sql
(v_line_total / v_n) + (CASE WHEN elem.ord <= (v_line_total % v_n) THEN 1 ELSE 0 END)
```

— `base = floor(total/n)`, and the first `remainder` participants **in the exact array order the client sent for that item** (via `jsonb_array_elements_text(...) WITH ORDINALITY`, not global participant `position`) each get one extra cent. This is the identical algorithm to the frontend's `splitCentsEqually()` (`src/lib/splitExpenses.ts`) — verified via matching unit tests on both sides (§44.19) so the two never disagree. `n=1` (mine/someone_else) degenerates to "the one participant gets the full line total", so one `INSERT ... SELECT` covers all three assignment types uniformly. `SUM(share_cents)` per item is verified to equal the item's own `line_total_cents` by construction (integer floor-division + exact remainder distribution always reconstructs the total exactly).

**Receipt-total reconciliation:** after every item on a receipt is inserted, `submit_split_expense()` compares the running sum of item line totals against the receipt's declared `receipt_total_cents` and rejects the whole submission (`'Receipt items do not add up to the receipt total'`) if they disagree — matching the current frontend model where `receiptItemsSubtotalCents()` (sum of item totals) is the amount actually being split; tax/tip/fee/discount rows are shown truthfully in the UI but are **not** split (§44.10 documents this as a v1 limitation, not invented OCR-specific behavior).

### 44.8 Cross-receipt netting and the settlement algorithm

**Core requirement:** ALL receipts in a split net together into ONE final settlement per pair — never separate per-receipt reimbursements. `split_participants.allocated_total_cents`/`paid_total_cents` are each a running SUM across every receipt in the split (§44.9's UPDATE queries), and `_compute_split_settlements()` operates on those split-wide totals, not per-receipt.

`_compute_split_settlements(p_split_id)` (internal, never granted to `authenticated`) — deterministic debtor/creditor matching, identical in shape to the frontend's `computeSettlements()`:

1. Walk participants in their submitted `position` order (same stable order the frontend preview used), split into debtors (`net_cents < 0`) and creditors (`net_cents > 0`), each as a `public.split_balance_t[]` array (`(user_id, remaining)` composite type).
2. Two-pointer greedy match: `transfer = LEAST(debtor.remaining, creditor.remaining)`; `INSERT INTO split_settlements`; decrement both; advance whichever side hit zero; repeat.

Produces at most `(participants with a nonzero balance) - 1` transfers, no zero-value rows, deterministic ordering. `split_settlements` has `UNIQUE(split_id, from_user_id, to_user_id)` — at most one net transfer per ordered pair.

**Worked multi-receipt example (live-verified, §44.20):** creator pays Receipt A ($30, split 50/50 with friend), friend pays Receipt B ($20, split 50/50) — net-per-receipt would show two separate $15/$10 reimbursements; cross-receipt netting instead produces a single $5 transfer (friend → creator) reflecting the true combined balance. Verified live inside a rolled-back transaction against real test accounts.

### 44.9 Participant totals

After every receipt/item/allocation is inserted, two `UPDATE` statements set each participant's split-wide totals:

- `allocated_total_cents` = SUM of `split_item_allocations.share_cents` across every item across every receipt in the split, for that user.
- `paid_total_cents` = SUM of `split_receipts.receipt_total_cents` for every receipt where that user was `payer_user_id`.

A safety-net reconciliation check (`SUM(paid) = SUM(allocated)` across the whole split) is then verified — guaranteed true by construction (one payer per receipt pays exactly that receipt's total; every item's shares sum to exactly its own line total) but checked explicitly rather than merely assumed, raising `'Split totals do not reconcile'` if it ever fails. `net_cents = paid_total_cents - allocated_total_cents`, computed on read (in `_split_expense_summary`), never stored — positive means "should receive money", negative means "owes money".

### 44.10 Transaction semantics — economic share, not amount personally paid

**The critical distinction:** a generated transaction represents a participant's **economic responsibility** for a receipt, not the full amount they personally handed over at checkout. Example: creator pays $60 for a $60 receipt split 3 ways ($20 each) — the creator's own generated transaction is $20 (their share), not $60 (what they paid); the other $40 they fronted is recovered via the settlement, never double-counted as a second $40 "expense". This is why `submit_split_expense()`/`accept_split_expense()` both group by receipt and `sum(sia.share_cents)` **for that specific user**, not the receipt's full total.

**One transaction per receipt per participant with share > 0** — never per item. `GROUP BY sr.id, sr.merchant, sr.receipt_date, sr.category_id` collapses however many items a participant is allocated on a receipt into one `INSERT INTO transactions`. Content: `user_id` (the participant), `category_id` (the receipt's global expense category), `amount` (their share, converted from cents), `merchant` (the receipt's), `occurred_at` (§44.13), `note = 'Split expense'` — deliberately never includes another participant's email or name.

Tax/tip/fee/discount rows (`SplitReceiptExtraRow` in the frontend) are shown truthfully in the receipt UI but are not currently split or reflected in any generated transaction — a documented v1 limitation (§44.16), not invented OCR-specific behavior.

### 44.11 Idempotency

Client-generated `idempotencyKey` (a UUID, generated once per submission attempt in `useSplitExpensesState.ts`, persisted across repeated Submit clicks/retries of the *same* attempt including after a failure — a fresh key is only generated when the user edits and re-processes). `submit_split_expense()` checks `SELECT id FROM split_expenses WHERE created_by=auth.uid() AND idempotency_key=...` **first, before any other validation or write** (so a retry never partially re-validates against possibly-changed state, e.g. a friend removed between attempts) and, if found, immediately `RETURN public._split_expense_summary(v_existing_id)` — the exact same authoritative response, never a duplicate split. The real DB-level backstop against a genuine race (not just a sequential retry) is `UNIQUE(created_by, idempotency_key)` on `split_expenses` itself.

### 44.12 Currency restriction

The creator's own `profiles.currency` is authoritative; the payload's `currency` field must match it (catches a stale frontend), and **every other participant's own configured currency** must also match — checked per-participant inside the loop (`EXISTS(...profiles p...p.currency = v_creator_currency)`). No FX conversion exists in v1; a mismatch produces the safe message `'Split Expenses currently requires all participants to use the same currency.'`, never a raw constraint error.

### 44.13 Category restriction and date/timezone semantics

**Category:** must exist, `type = 'expense'` (verified server-side, never trusting frontend filtering — `IF v_category.type <> 'expense'`), and `user_id IS NULL` (a **global** category, since `categories`' own INSERT RLS policy — `WITH CHECK (auth.uid() = user_id)`, never NULL — proves there is no client path to create a global category at all, so accepting a personal category here would either fail for other participants or silently leak one user's private category taxonomy into another's data). The frontend's `CategoryPicker` gained a `globalOnly` prop (§44.14) so the Split category picker only ever offers categories every participant can safely use, and disables the "create new" affordance entirely (creating a new global category has no safe client path either).

**Date/timezone:** `receipt_date` is a calendar date (no time-of-day). For each generated transaction, `occurred_at` is anchored to **noon, in the TARGET participant's own configured `profiles.timezone`** — `(receipt_date + time '12:00') AT TIME ZONE v_target_tz` — reusing the exact idiom established in Backend Part 4/5 (`transactionDate.ts`'s `occurredAtFromZonedDateInput`, replicated server-side), never the submitting browser's timezone. For the creator's own immediate transactions this is the creator's own timezone; for `accept_split_expense()` it is the *accepting* participant's own timezone, looked up fresh at accept-time — never a value carried over from submission time.

### 44.14 Frontend — Submit integration

`buildSubmitSplitExpensePayload()` (pure, `src/lib/splitExpenses.ts`) maps the local `YOU_PARTICIPANT_ID` placeholder to the real `creatorUserId` everywhere it appears (participants list, every item's `participantIds`, `payerUserId`); `totalCents` is `receiptItemsSubtotalCents(receipt)` (items subtotal, matching the server's own definition of "receipt total" — not `parsedTotalCents`, which includes tax); sends only raw `assignmentType`/`participantIds` per item, never a client-computed `share_cents` — the server independently recomputes everything (§44.7).

New `isRealNexaliUser: boolean` on `Participant` distinguishes real Friends-backed participants (real Supabase user id — `true` for "You" and real friends) from a manually-added, non-Nexali person (client-generated placeholder id, `false`). The pre-existing "Add someone manually" capability is intentionally preserved (informal/offline splitting still works) but `isSubmittableToBackend(participants)` blocks real Submit until every participant is real.

`SplitPreview.tsx`: `handleSubmit()` builds the payload and calls the new `useSubmitSplitExpense(userId)` mutation. Submit is disabled while pending (no duplicate submission) and while `!isSubmittableToBackend`, with an inline warning explaining why. Preview state is fully preserved during pending and on failure (a `StatusBanner` shows the real server error; the same `idempotencyKey` is reused on retry — no new key is generated on a failed-then-retried attempt). On success, the footer switches to a `SubmitSuccessBanner`: "Your N Nexali transaction(s) were created" (the server's real `creatorTransactionCount`, never assumed) plus "N friends still need to accept their shares" (or "Everyone is already settled" for a creator-only split) — truthful, server-derived numbers only, never a claim that every friend's transaction already exists. `submitResult` is not auto-cleared; a new "Start a New Split" button (wired to `resetSplit()`) is the only way to clear it, so a completed submission's confirmation stays visible until the user explicitly moves on.

`CategoryPicker.tsx` gained `globalOnly?: boolean` (§44.13): both `useListCategories` and the new `useListGlobalExpenseCategories()` are always called (Rules-of-Hooks-safe), the result selected conditionally; `showCreate` is forced `false` when `globalOnly`. `ReceiptCard.tsx`'s Split category picker always passes `globalOnly`.

### 44.15 Notification integration — reused, not duplicated

New migration `supabase/migrations/20260921000100_split_expenses_notifications_integration.sql` — additive only, mirroring `20260919000100_friends_notification_integration.sql`'s own pattern:

- `notifications.type`'s CHECK is widened to add `'split_expense'`.
- A new nullable `split_expense_id uuid REFERENCES split_expenses(id) ON DELETE CASCADE` — deliberately the **split's own id**, not `split_participant_id`: the frontend's `accept_split_expense(p_split_id)`/`decline_split_expense(p_split_id)` RPCs take the split id directly, and `split_participants` has no direct table grant for `authenticated` to resolve one from the other (RPC-only surface). `ON DELETE CASCADE` (unlike `friend_request_id`'s `SET NULL`): a `split_expense` notification has no meaning once its split is gone, unlike a friend request notification which still identifies a real, separate recipient.
- A supporting partial index, `notifications_split_expense_id_idx ... WHERE split_expense_id IS NOT NULL`.
- No new `notification_preferences` toggle — split-expense notifications are always delivered in v1, matching the friend-request precedent.
- **Filtering:** no new tab. The existing "System" tab's query widened to `type IN ('system', 'friend_request', 'split_expense')`.

`submit_split_expense()` inserts one notification per non-creator participant, `dedupe_key = 'split:' || split_id || ':participant:' || user_id`, description showing **only the recipient's own** allocated share and the split's currency code (`'Sarah Tran added you to a split expense. Your share is $12.50.'`) — never the group total, another participant's amount, or receipt-level detail.

`Notifications.tsx`: unlike `friend_request` (a dedicated card, since it needs a cross-referenced sender lookup), a `split_expense` notification's own description already says everything needed, so it reuses the generic `NotificationItem`'s `inlineActions` mechanism directly — Decline/Accept buttons call `useDeclineSplitExpense`/`useAcceptSplitExpense` with `n.splitExpenseId`, no separate card component. **Manual dismiss is never interpreted as accept or decline** — dismissing only calls the generic `dismissNotification` mutation; the split stays `pending` for that participant until they explicitly Accept or Decline (via this notification, since no separate Split history/inbox UI currently exists to respond from elsewhere — a documented v1 limitation, §44.16). Both `accept_split_expense`/`decline_split_expense` resolve (mark read + dismissed) their own notification atomically, so any *visible* `split_expense` notification is, by construction, still pending.

### 44.16 Known limitations (v1, documented)

- Tax/tip/fee/discount rows are shown truthfully but not split or reflected in any generated transaction (§44.10).
- No FX conversion — all participants in a split must share the creator's configured currency (§44.12).
- Only global (not personal) expense categories may be used for a Split receipt, and there is no client path to create a new global category (§44.13) — a user wanting a category not yet global must ask an app maintainer, or use an existing one.
- Declining a split does not automatically re-allocate the declining participant's share to anyone else — the split is marked `needs_attention` and the creator must see and manually resolve it (no edit/resubmit flow exists yet).
- Friendship validity is checked only at submission time — a friendship removed afterward does not invalidate an already-submitted split or block a pending participant's later accept/decline (§44.5).
- If a receipt's payer later deletes their account, that receipt (and its items/allocations) cascades away, even if other participants already accepted and have real, untouched transactions for other receipts in the same split (§44.3).
- **Generated transactions behave exactly like any other transaction** (Option A, chosen over a "locked"/read-only Option B, which would require new, unapproved UI) — editable and deletable via the existing Transactions page. Deleting one only removes its `split_generated_transactions` provenance row (`ON DELETE CASCADE` from `transactions`); it does not retroactively alter the split's own historical participant/settlement records, which remain the permanent record of what was agreed.
- No "Mark Paid" workflow for `split_settlements.settled_at` — the column is reserved for a future affordance; nothing in this Part sets it. No real external payment processing exists or is implemented.
- No realtime subscription — a new split-expense notification does not appear until the next refetch/navigation, matching every other notification type in this codebase.

### 44.17 Account deletion

New migration `supabase/migrations/20260921000300_delete_user_everything_split_cleanup.sql` extends `delete_user_everything()` via `CREATE OR REPLACE` (preserving the existing `service_role`-only guard/REVOKE/GRANT discipline unchanged), inserted before the existing Friends/Notifications/financial deletes: `split_generated_transactions` (as generator), `split_settlements` (either side), `split_item_allocations` (as allocatee), `split_receipts` (as payer), `split_participants` (as participant), `split_expenses` (as creator — cascades away that split's own receipts/items/allocations/settlements/provenance not already explicitly removed above). Every relevant FK already carries `ON DELETE CASCADE` to `auth.users`, so these rows would be cleaned up automatically once the delete-user Edge Function's `auth.admin.deleteUser()` runs — these explicit deletes match the same delete-order-independent discipline already established for Friends/Notifications, since `delete_user_everything()` runs *before* that cascade-triggering call.

### 44.18 Database types

`src/types/database.types.ts`: full Row/Insert/Update/Relationships blocks for all 7 new tables; `notifications` Row/Insert/Update gained `split_expense_id: string | null` plus its `Relationships` entry (`referencedRelation: "split_expenses"`); `submit_split_expense`/`accept_split_expense`/`decline_split_expense` added to `Functions` with exact `Args`/`Returns` shapes. No `any`. Verified clean via `npx tsc -b --force`.

### 44.19 Tests added

- `src/lib/splitExpenses.test.ts` — `isSubmittableToBackend` (3 tests) and `buildSubmitSplitExpensePayload` (7 tests), plus existing fixtures updated for `isRealNexaliUser`.
- `src/lib/splitExpensesData.test.ts` (new) — the 3 RPC wrappers' exact call shape, response mapping, and real-error propagation.
- `src/features/splitExpenses/useSubmitSplitExpense.test.tsx` (new) — all 3 mutation hooks' exact invalidation sets (submit: financial + splitRoot, no notifications; accept: financial + notifications + splitRoot; decline: notifications + splitRoot only, no financial).
- `src/features/splitExpenses/useSplitExpensesState.test.tsx` — `idempotencyKey` lifecycle (null initially, generated once, stable across re-renders/retries, fresh only on edit→re-process) and `resetSplit()`.
- `src/lib/friends.test.ts` — `toSplitParticipant` updated for `isRealNexaliUser: true`.
- `src/pages/SplitExpenses.test.tsx` — real Submit-flow tests: exact payload shape, pending/duplicate-click prevention, failure preserves the full Preview with a safe error, retry reuses the same idempotency key, truthful success confirmation using real server-returned counts, state not cleared until "Start a New Split", Submit blocked with a clear message when a manually-added participant remains.
- `src/features/splitExpenses/splitExpensesMigrations.test.ts` (new) — static verification of all 4 migrations: all 7 tables/constraints/cents-typing, the idempotency unique constraint, the RLS-recursion-avoidance helper-function pattern (and that no policy embeds a raw cross-table subquery), no direct table grant to `authenticated`/`anon`, every RPC's `auth.uid()`-only identity/null-rejection/`SECURITY DEFINER`/search_path/REVOKE-GRANT shape (and that no RPC accepts a caller-id parameter), the internal helpers' non-grant, the idempotency-check-before-validation ordering, currency/friendship/category validation, the mine/someone_else/shared count rules, the deterministic equal-cents `WITH ORDINALITY` SQL, the receipt-total reconciliation check, the paid=allocated safety net, one-transaction-per-receipt via `GROUP BY`, the noon-target-timezone conversion, the per-participant (never-creator) notification, `accept_split_expense`'s `WHERE ... = auth.uid()` authorization boundary and idempotency/`ON CONFLICT` shape, finalization logic, `decline_split_expense`'s no-transaction/already-accepted-rejection/`needs_attention` behavior, and the account-deletion migration's new deletes plus unchanged guard.
- `src/pages/Notifications.test.tsx` — new "split_expense notifications" describe block: renders via the generic `NotificationItem` with real Accept/Decline inline actions, Accept/Decline call the real mutations with the correct split id, per-split pending-disable, a safe fallback with no inline actions when `splitExpenseId` is absent, manual dismiss calls only the generic dismiss mutation (never accept/decline), the System tab includes `split_expense` rows, and the unread count reflects a new one like any other type.
- `src/lib/notificationsData.test.ts` — the System tab's query now includes `split_expense`, and `split_expense_id` maps through onto `NotificationItemData` (including the null case).

### 44.20 Live verification (rolled-back transactions, real test accounts)

Every RPC was executed against the real linked project inside `BEGIN ... ROLLBACK` transactions, impersonating real test users via `set_config('request.jwt.claim.sub', ...)` / `SET LOCAL ROLE authenticated` — never against a real browser session, and never actually committed. Test fixtures: `ddc3226c-ec9e-49f0-ba10-c76301223ca5` ("Pickle Junior", creator) and `829d4446-6184-4d97-88d7-86a409fc1190` ("Jordan Van", friend), both `currency='USD'`, `timezone='America/Los_Angeles'`, an already-real accepted friendship between them; global expense category id 31 "Food And Dining"; global income category id 59 "Salary And Wages" (used to confirm income-category rejection).

Verified: the cross-receipt-netting worked example (§44.8); idempotent replay (same key → same result, no duplicate split); `accept_split_expense` creating the real, correctly-grouped, correctly-timezoned transaction(s) for the accepting participant only, and correctly resolving their own notification (confirmed via `resolve_check: true` after initially seeing an expected-by-RLS `null` when querying as the creator, who cannot SELECT another user's notification row); `decline_split_expense` creating no transaction and marking `needs_attention`; and five distinct validation-rejection scenarios (non-friend participant, currency mismatch, personal/non-global category, income-type category, receipt-items-sum mismatch) each producing the correct safe error with no partial write (confirmed via `ROLLBACK`, not merely the error message).

### 44.21 Security summary

`auth.users`/other participants' financial data is never exposed beyond what each RPC's own caller is entitled to see. The single cross-user financial-write boundary: `submit_split_expense()` may only ever create a transaction for `auth.uid()` (the submitting creator, inside its own atomic call); every other participant's transactions are created **only** when that participant calls `accept_split_expense()` themselves, whose entire authorization is `WHERE split_id = p_split_id AND user_id = auth.uid()` — no function in this Part accepts a `p_user_id`/participant-id parameter for whose account to act on, so there is no way for the creator (or anyone else) to write a transaction into another user's account without that user's own acceptance call. Every RPC rejects a null `auth.uid()`, pins `search_path`, schema-qualifies every reference, and has `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated` only (no `anon` grant); the two internal helpers (`_compute_split_settlements`, `_split_expense_summary`) are never granted to `authenticated` at all. All 7 tables have RLS enabled and no direct `authenticated` table grant — every real read/write goes through the RPC-only surface.

### 44.22 Confirmations

Split Expenses page/Notifications page/navigation were not visually redesigned — only Submit's real wiring and the category picker's `globalOnly` restriction are new. `friend_requests`/`friendships` tables and friend search behavior were **not modified** — friendship validation during submission is a read-only query against the existing live table. Aura was not started. No historical migration file was edited — all 4 new migrations are forward-only; `delete_user_everything` was updated via `CREATE OR REPLACE` in a new migration, matching the established pattern. No commit or push occurred. Migrations were **not** applied to the live database — `npx supabase db push` was not run.

### 44.23 Quality gates (this Part)

`npx tsc -b --force`: 0 errors. `npm run lint`: 0 errors, 0 warnings. `npm run build`: succeeds (same pre-existing >500kB chunk-size warning, unrelated to this Part). `npm run test` (`npx vitest run --maxWorkers=2`): full suite passing — see the final report for the exact file/test counts; the only failures seen mid-Part were (a) four pre-existing UI test files whose `useCategories` mock predated `CategoryPicker`'s new unconditional `useListGlobalExpenseCategories()` call, fixed by extending those mocks, and (b) one already-established, environmental Vitest worker-timeout flake (a debounce test in `useFriendsQueries.test.tsx`), confirmed non-regression by an immediate clean retry.

### 44.24 Recommended next phase

With Split Expenses backend approved and deployed, the natural next phases are: (1) Aura (explicitly on hold until now, per every prior Part's closing instruction), or (2) a Split-history/inbox UI surface so a participant can review and respond to a pending split expense from somewhere other than the Notifications feed (removing the manual-dismiss limitation noted in §44.15/§44.16), or (3) a "Mark Paid" workflow for `split_settlements.settled_at` if real settlement tracking becomes a priority. No specific recommendation is made without the user's direction — this Part implements exactly what was scoped, nothing more.
