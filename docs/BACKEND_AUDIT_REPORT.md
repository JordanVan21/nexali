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
