# Budget Tracker — Audit Report

**Date:** 2026-07-29 (Phase 1 audit); updated 2026-07-29 (Phase 2 stabilization)
**Phase:** Phase 1 ("Audit the repository" + "Fix build") and Phase 2 ("Make the toolchain trustworthy") of the `docs/MASTER_SPEC.md` implementation order are complete.
**Scope of changes made:** Phase 1 fixed build-blocking errors only. Phase 2 fixed every remaining lint error, the source-encoding defect, and the dead-code/debug-statement/dependency-drift hygiene issues Phase 1 identified but deliberately left in place. No redesign, no new product features, no AI Assistant in either phase.

---

## 1. Executive Summary

The repository is a real, partially working React 19 + TypeScript + Vite + Supabase budget tracker — not a mockup. Transactions, Budgets, Profile, and authentication all talk to live Supabase tables, RPCs, a database view, Storage, and an Edge Function. The architecture (feature-scoped TanStack Query hooks over a thin `lib/` Supabase layer, with centralized query keys) is sound and worth preserving.

Originally the project **did not build**: `npm run build` failed with 14 TypeScript errors, all of them unused-import/unused-variable violations of `noUnusedLocals`/`noUnusedParameters`. Phase 1 fixed those. `npm run lint` then still reported 26 errors, and the codebase carried dead files, ~250 lines of commented-out legacy JSX, 5 stray debug `console.log`s, an unreadable UTF-16LE-encoded generated types file, and two undeclared/unused npm dependencies. **Phase 2 fixed all of it.** `npm run build`, `npm run lint`, and `tsc -b --force` all now pass with **zero errors**.

**Phase 3 (this update) added the automated testing foundation** that Phases 1–2 explicitly deferred: Vitest, React Testing Library, `@testing-library/jest-dom`, `@testing-library/user-event`, and jsdom, wired into `vite.config.ts` with three new `npm` scripts (`test`, `test:watch`, `test:coverage`) and 14 passing tests across 4 files covering the shared `Button` and `Input`/`Label` components, a new `formatCurrency` utility, and `AuthGate`'s loading/redirect/success behavior. `tsc -b --force`, `npm run lint`, `npm run build`, and `npm run test` all pass with zero errors. Full detail in §15–16. No page component, Supabase schema, RLS policy, or AI Assistant work was touched — this phase is infrastructure only, a prerequisite for the frontend revamp plan (`docs/FRONTEND_REVAMP_PLAN.md`) rather than a step of it.

The three most serious functional findings:

1. **Sign Out does not sign the user out.** The navigation item is a plain `<Link to="/">`. `supabase.auth.signOut()` is never called outside account deletion, so the session survives and re-entering `/dashboard` restores the app. This is a security-relevant defect, not a cosmetic one.
2. **The Dashboard's "This Month" and "Month Net" figures are all-time totals.** The RPCs behind them (`sum_income_amount(uid)`, `sum_expense_amount(uid)`) accept no date range. The same applies to budgets: `sum_category_amount(uid, cat_id)` takes no period, so a July budget is compared against the user's entire spending history for that category. Every period-scoped number the app currently displays is mislabeled.
3. **There are zero Supabase migrations.** `supabase/migrations/` does not exist. The schema, RLS policies, Storage policies, the `v_tx_search` view, and all five RPCs live only in the remote project. The database is currently unreproducible and unreviewable, which blocks both the security review and the AI Assistant work.

The Reports page is an empty `<div>` while being advertised in the navigation, and the Settings route is commented out in `main.tsx` while its nav entry silently links to `/dashboard`.

A structural concern for the AI Assistant phase: the assistant requires deterministic, period-aware, timezone-aware financial tools. The current RPCs are none of those, and they take a caller-supplied `uid` rather than deriving identity from `auth.uid()`. The Assistant should not be built on top of them as they stand.

---

## 2. Current Architecture

### Layering

```
main.tsx                 Router + QueryClientProvider + StrictMode
  └── AuthGate           useUser() → redirect to /signin when unauthenticated
        └── UserIdProvider  React context supplying { userId, email }
              └── AppLayout   Navbar (props-driven) + <Outlet/>
                    └── pages/*
                          └── features/*    TanStack Query hooks (server state)
                                └── lib/*   Supabase calls, pure-ish data access
                                      └── supabaseClient.ts
```

- **`src/lib/`** — Supabase data access: `auth.ts`, `budgets.ts`, `categories.ts`, `profile.ts`, `storage.ts`, `transactions.ts`, `user.ts`, `utils.ts`.
- **`src/features/`** — React Query hooks grouped by domain: `budgets/`, `categories/`, `dashboard/`, `profiles/`, `transactions/`, `user/`, plus `querykeys.ts`.
- **`src/components/`** — App components (`Navbar`, `Card`, `Modal`, `FieldSet`, `TransactionTable`, `CategoryPicker`, `CategoryFilterDropdown`) and a shadcn-style `ui/` primitive set.
- **`src/pages/`** — `Dashboard`, `Transactions`, `Budgets`, `Reports`, `Profile`, `SignIn`, `SignUp`; `LandingPage.tsx` at `src/` root.
- **`src/shared/userIdContext.tsx`** — user identity context; throws if used outside `AuthGate`.
- **`src/types/database.types.ts`** — generated Supabase types.

### Routes

| Path | Component | Protected | State |
|---|---|---|---|
| `/` | `LandingPage` | no | works |
| `/signup` | `SignUp` | no | works |
| `/signin` | `SignIn` | no | works |
| `/dashboard` | `Dashboard` | yes | partial (2 widgets, wrong period) |
| `/transactions` | `Transactions` | yes | works, with caveats |
| `/budgets` | `Budgets` | yes | works, wrong period math |
| `/reports` | `Reports` | yes | **empty stub** |
| `/profile` | `Profile` | yes | partial (3 of 8 settings persist) |
| `/settings` | — | — | **commented out in `main.tsx`; nav points to `/dashboard`** |

Only `/dashboard` is wrapped in `WithErrorBoundary`; the other four protected routes are not. No route is lazy-loaded.

### Database schema (from generated types)

**Tables**
- `profiles` — `id`, `full_name`, `avatar_url`, `budget_reset_cycle`, `reset_day`, `timezone`, `created_at`
- `categories` — `id`, `name`, `type`, `user_id` (nullable → `NULL` means a global category), `created_at`
- `transactions` — `id`, `user_id`, `category_id`, `amount`, `merchant`, `note`, `created_at`
- `budgets` — `id`, `user_id`, `category_id`, `amount`, `month`, `year`, `created_at`

**View:** `v_tx_search` (transactions joined to category name/type; used for all filtered searches)

**RPCs:** `sum_category_amount(uid, cat_id)`, `sum_expense_amount(uid)`, `sum_income_amount(uid)`, `is_valid_tz(tz)`, `delete_user_everything(p_user_id)`

**Storage:** `avatars` bucket, public URLs, one folder per user (`${userId}/${filename}`)

**Edge Function:** `delete-user`

Two schema gaps matter for the spec:
- `transactions` has **no dedicated date column** — `created_at` doubles as the transaction date, so a user cannot backdate a transaction.
- `profiles` has **no `currency`, `date_format`, `number_format`, or `theme` columns** — the corresponding Profile controls cannot persist and are rendered `disabled`.

---

## 3. Working Features

Verified by reading the wired-up code paths end to end (Supabase call → hook → component → route).

**Authentication**
- Sign up with email/password, `full_name` passed as user metadata, "check your email" confirmation message.
- Sign in with email/password, error surfaced inline, redirect to `/dashboard`, duplicate submits blocked via `isPending`.
- Route protection: `AuthGate` redirects unauthenticated users to `/signin` and provides `userId` via context.

**Transactions** (the most complete area)
- List via the `v_tx_search` view.
- Create, edit, and delete, with optimistic updates and rollback on error in `useSaveTransaction` / `useDeleteTransaction`.
- Server-side input validation in the mutation layer: finite amount, `> 0`, `<= 999999999`, merchant/note length caps at 500 chars.
- Category selection with create-on-the-fly via `CategoryPicker`, including title-case normalization shared with the backend helper.
- Filters: date range, category (multi), type (income/expense), min/max amount, sort by date/amount/category with direction toggle, and a clear-filters control with active-filter badges.
- Distinct mobile card layout and desktop table layout.
- Query invalidation fans out correctly to transactions, totals, and spent-amount keys.

**Budgets**
- List, create, edit, delete, with a gauge chart per budget and a color threshold at 75% / 95%.
- Form validation: amount `> 0`, month 1–12, year 2000–2100, category required.
- Loading, error, and empty states are all present.

**Categories**
- Global (`user_id IS NULL`) and personal categories are merged, de-duplicated by lowercased name with global preferred, and returned sorted.
- Name normalization to title case is applied consistently on both create and lookup paths.

**Profile**
- Full name and email displayed (read-only).
- Avatar upload and delete against Supabase Storage, with per-user folder paths and filename sanitization.
- Timezone, budget reset cycle, and reset day persist to `profiles`.
- Save feedback toast on success and error, auto-dismissing.
- Account deletion via the `delete-user` Edge Function, followed by sign-out, cache clear, and redirect.

**Dashboard**
- Income, spent, and net widgets render live data with loading and error states.
- Typewriter welcome animation using the profile's full name.

**Landing page** — renders, animates in phases, routes to `/signin`.

**Shell** — sticky Navbar with active-route highlighting, desktop hover dropdown, and a mobile `Sheet` menu.

---

## 4. Broken and Unfinished Features

### 4.1 Broken

| # | Finding | Location | Impact |
|---|---|---|---|
| B1 | **Sign Out never signs out.** Nav item is `<Link to="/">`; `supabase.auth.signOut()` is called only in the account-deletion path. Session persists in storage. | [AppLayout.tsx:12-13](src/AppLayout.tsx#L12-L13), [Navbar.tsx:93-107](src/components/Navbar.tsx#L93-L107) | High — security |
| B2 | ~~**Conditional hook call.** `BudgetCard` returned early on `if (!categories) return null` *before* calling `useUserInfo`, `useSpentAmount`, and `useMemo`.~~ **Fixed in Phase 2** — the early return now happens after all hooks are called; this was also a live `react-hooks/rules-of-hooks` lint error the Phase 1 audit's lint table missed. | [Card.tsx](src/components/Card.tsx) | Resolved |
| B3 | **"Select Single Date" always returns zero rows.** Sets `fromISO === toISO`, and the query applies `.gte(created_at, from)` *and* `.lt(created_at, to)` — an unsatisfiable range. | [Navbar.tsx:341-344](src/components/Navbar.tsx#L341-L344), [transactions.ts:113-119](src/lib/transactions.ts#L113-L119) | High |
| B4 | **`budget.categories.type` is always `undefined`.** The query selects only `(id, name)` but the result is cast `as Budget[]`, and `Budget` declares `type`. The cast hides the mismatch. | [budgets.ts:30-51](src/lib/budgets.ts#L30-L51) | Medium |
| B5 | **Dead query invalidation.** `useSaveBudget` invalidates `qk.budgets(userId, year, month)` = `["budgets", userId, year, month]`, but the list query uses `qk.budgetsRoot(userId)` = `["budgets", userId]`. Invalidating a *child* key does not invalidate the parent. Masked only by an explicit `refetch()` passed from the page. | [useBudgetOps.ts:35-41](src/features/budgets/useBudgetOps.ts#L35-L41) | Medium |
| B6 | **Pagination is wrong past 50 rows.** The server query caps at `limit ?? 50`, then the table paginates that slice client-side. `transactions.length` is the fetched slice, so "1-10 of 50" is shown even when the user has 500 transactions, and rows beyond 50 are unreachable. | [transactions.ts:151-153](src/lib/transactions.ts#L151-L153), [TransactionTable.tsx:104-110](src/components/TransactionTable.tsx#L104-L110) | High |
| B7 | **String id injected into a numeric field.** `id: row.id \|\| \`temp-${Date.now()}\`` produces a string where `TxId` is `number`. | [transactions.ts:159](src/lib/transactions.ts#L159) | Medium |
| B8 | **Avatar refetches on every render.** `select: (url) => url ? \`${url}?v=${Date.now()}\`` returns a new string each render, so the `<img>` src changes continuously. | [useAvatar.ts:75](src/features/profiles/useAvatar.ts#L75) | Medium — performance |
| B9 | **`text-success` does not exist.** No `--success` token in `index.css` and no `success` color in `tailwind.config.js`, so the budget "Remaining" figure renders unstyled. | [Card.tsx:131](src/components/Card.tsx#L131) | Low |
| B10 | **Typo `rounded-x1`** (digit one) instead of `rounded-xl`. | [Card.tsx:26](src/components/Card.tsx#L26) | Low |
| B11 | **No expired-session handling.** There is no `onAuthStateChange` subscription anywhere. `useUser` caches for 5 minutes and `getCurrentUser` swallows errors by returning `null`, so a revoked or expired session surfaces as scattered query failures rather than a redirect. | [userUser.ts](src/features/user/userUser.ts), [user.ts:7-10](src/lib/user.ts#L7-L10) | Medium |
| B12 | **Mixed dialog-opening mechanisms.** `Modal`/`BudgetModal` open via `dlgRef.current.showModal()`, but `Budgets.tsx` and `TransactionTable.tsx` open the same dialogs via `document.getElementById(...)`. Two sources of truth for one piece of UI state. | [Budgets.tsx:18-24](src/pages/Budgets.tsx#L18-L24), [TransactionTable.tsx:69-84](src/components/TransactionTable.tsx#L69-L84) | Medium |

### 4.2 Period and formatting correctness

| # | Finding | Impact |
|---|---|---|
| P1 | **Dashboard "This Month" / "Month Net" are all-time totals.** `sum_income_amount(uid)` and `sum_expense_amount(uid)` accept no date range, yet the UI labels the result "This Month" and "Income - Expenses this month". | High — misleading financial data |
| P2 | **Budget spend ignores the budget period.** `sum_category_amount(uid, cat_id)` has no month/year argument, so a July 2025 budget is measured against all-time spending in that category. | High — misleading financial data |
| P3 | **Budgets from all periods are listed together** with no period navigation and no duplicate-budget prevention. | Medium |
| P4 | **The saved timezone is never used.** `profiles.timezone` persists but no calculation or display reads it; all dates use browser-local `toLocaleDateString()`. | High — blocks the Assistant |
| P5 | **Currency is hardcoded to USD.** A `USD` `Intl.NumberFormat` in `Dashboard`, and bare `$` string concatenation in `Card` and `TransactionTable`. | Medium |
| P6 | **Transaction date is not user-selectable.** Insert always stamps `new Date().toISOString()`; editing cannot change it. | Medium |

### 4.3 Incomplete

- **Reports page** — an empty `<div>`. None of the spec's charts, date controls, CSV download, or empty states exist. [Reports.tsx](src/pages/Reports.tsx)
- **Dashboard** — 2 of the 12 spec'd elements. Missing: remaining budget, budget utilization, spending by category, recent transactions, budget warnings, trend chart, period selection, empty states, assistant entry point.
- **Profile/Settings** — currency, number format, and (absent) date format controls are rendered `disabled` with no backing columns. Missing entirely: theme preference, password-reset access, sign out, and all AI-related settings.
- **Authentication** — missing forgot password, reset password, password visibility toggle, email-verification resend, and safe post-login redirect (always hardcoded to `/dashboard`).
- **Categories** — no dedicated management UI. Categories can only be created as a side effect of the transaction/budget pickers; renaming and deleting personal categories are not possible.

### 4.4 Placeholder-only / advertised but not implemented

| Item | Detail |
|---|---|
| "Settings" nav entry | Links to `/dashboard`; the route is commented out in [main.tsx:31](src/main.tsx#L31) |
| "Sign Out" nav entry | Links to `/`; does not sign out (B1) |
| "Reports" nav entry | Route renders an empty div |
| Currency / Number Format selects | `disabled`, no persistence, no DB columns |
| Landing page "Goal Tracking" | Advertised twice as a core feature; no goals feature exists anywhere |
| Temporary branding | Logo string `"JV DUMPY"` in [AppLayout.tsx:8](src/AppLayout.tsx#L8). Approved replacement: **Nexali** (see `docs/design-reference/README.md`). |
| Personal placeholder data | Real-looking personal emails as input placeholders in [FieldSet.tsx:56](src/components/FieldSet.tsx#L56) and [FieldSet.tsx:164](src/components/FieldSet.tsx#L164) |
| Page title / favicon | `"Vite + React + TS"` and `/vite.svg` in [index.html](index.html) |
| README | Still the unmodified Vite starter template |
| `.dark` theme block | Defined in `index.css` but nothing ever toggles the class; base `:root` is already dark, and the `.dark` overrides would replace the green accent with near-white |

### 4.5 Code hygiene

All items below were identified in the Phase 1 audit and **fixed in Phase 2** (see §13). Kept here as the historical record of what was wrong.

- ~~**13 `console.*` statements** in shipped code, including a per-render `console.log("Phase:", …)` in `LandingPage.tsx:26` and filter logging in `transactions.ts:107`.~~ **Fixed** — the 5 stray debug logs were removed; the 8 remaining `console.error`/`console.warn` calls are legitimate error surfacing and were kept.
- ~~**~18 `any` usages**, mostly `(err as any)?.message` in error branches.~~ **Fixed** — zero `any` remain. Query/mutation `.error` access now relies on TanStack Query's default `Error` typing instead of casting; a shared `getErrorMessage(unknown)` helper in `lib/utils.ts` handles `catch` blocks, which TypeScript types as `unknown`.
- ~~**Large commented-out legacy blocks** — the previous daisyUI implementation is retained in `Dashboard.tsx` (~75 lines), `Profile.tsx` (~100 lines), `FieldSet.tsx` (~70 lines), `Card.tsx`, `Modal.tsx`, and `Budgets.tsx`.~~ **Fixed** — all six removed.
- ~~**Dead file** — `src/hooks/useAvatar.ts` is an unreferenced duplicate of `src/features/profiles/useAvatar.ts`.~~ **Fixed** — deleted.
- ~~**Dead component** — `src/components/ui/dialog.tsx` is imported nowhere.~~ **Fixed** — deleted, along with `src/components/ui/command.tsx` (the shadcn `Command`/`cmdk` wrapper), which turned out to be `dialog.tsx`'s only remaining consumer and was itself unreferenced anywhere in the app. Its empty-interface pattern was the `@typescript-eslint/no-empty-object-type` lint error. `@radix-ui/react-dialog` stays as a dependency — `ui/sheet.tsx` (the live mobile-nav sheet) is built directly on it.
- **`pathFromPublicUrl` is duplicated three times** — `lib/storage.ts`, `features/profiles/useAvatar.ts`, and inline inside the Edge Function. **Not fixed** — consolidating call sites across the Edge Function boundary is a behavioral refactor, deferred to Phase 5.
- **Oversized components** — `Navbar.tsx`, `FieldSet.tsx`, `TransactionTable.tsx`, `Profile.tsx`. **Not fixed** — splitting these is a structural refactor with real regression risk, deferred to Phase 5 (roadmap item 19).
- **Misleading module names** — `Card.tsx`, `FieldSet.tsx`, `Navbar.tsx` each export multiple unrelated components; `features/user/userUser.ts` is a typo for `useUser.ts`. **Not fixed** — same reasoning as above.
- ~~**Dependency drift** — `date-fns` used but undeclared; `react-day-picker` and `cmdk` unused but declared; `daisyui` unused.~~ **Partially fixed** — `date-fns` is now declared, `react-day-picker` and `cmdk` were removed (`cmdk` only after `ui/command.tsx` was confirmed dead). `daisyui` was **not** removed: a final verification pass before touching `tailwind.config.js` found `text-base-content` (a daisyUI utility class) still live in `FieldSet.tsx`, `TransactionTable.tsx`, and `Profile.tsx`, outside any comment block. Removing the plugin would have silently unstyled that text — the Phase 1 finding was checked against the wrong set of class names.
- ~~**`database.types.ts` is UTF-16LE encoded**, so ESLint reports `Parsing error: File appears to be binary`.~~ **Fixed** — re-encoded to UTF-8 (no BOM) via a byte-for-byte content-preserving conversion; content is otherwise unchanged.

---

## 5. Build and Lint Results

### Commands available in `package.json`

`dev`, `build`, `lint`, `preview`. **There is no `test` script and no test runner installed.**

> **Update (Phase 3):** `test`, `test:watch`, and `test:coverage` scripts and a Vitest-based test runner now exist. This subsection is left as the historical Phase 1 record — see §15–16 for the current testing setup and results.

### Before the fix

```
npm install   → up to date, 407 packages, 18 vulnerabilities (1 critical, 13 high, 2 moderate, 2 low)
npm run build → FAILED: 14 TypeScript errors
npm run lint  → FAILED: 44 errors
npm test      → not available
```

The 14 build errors, all `TS6133` (declared but never read) or `TS6192` (all imports unused):

| File | Errors |
|---|---|
| `src/components/FieldSet.tsx` | `X`; two fully-unused import declarations; `catOptions` |
| `src/components/Modal.tsx` | unused `./ui/dialog` import declaration |
| `src/components/TransactionTable.tsx` | `useTransactions`; `hasActiveFilters` |
| `src/components/ui/calendar.tsx` | `React`; `numberOfMonths` |
| `src/LandingPage.tsx` | `Shield`; `Smartphone` |
| `src/pages/Dashboard.tsx` | `COLORS` |
| `src/pages/Profile.tsx` | `dateFormat`; `setDateFormat` |

### After the Phase 1 fix

```
npm run build → PASSES (built in 13.46s)
npm run lint  → 26 errors remaining (down from 44)
npx vite      → dev server starts cleanly, ready in ~1.1s
```

Production bundle: `index.js` **890.92 kB** (272.00 kB gzip) — over Vite's 500 kB warning threshold, as a single chunk with no route splitting. CSS 84.90 kB. The `blank_profile_pic.jpg` asset ships at 219 kB unoptimized.

### Lint errors after Phase 1 (26 — left in place deliberately, fixed in Phase 2)

| Rule | Count | Notes |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | 15 | Mostly `(err as any)?.message`; needs a typed error helper |
| `react-refresh/only-export-components` | 5 | `badge.tsx`, `button.tsx` (variant exports), `userIdContext.tsx` (×3) |
| `no-useless-escape` | 1 | `storage.ts:4` — `\-` inside a character class |
| `@typescript-eslint/no-empty-object-type` | 1 | `command.tsx:24` |
| Parsing error | 1 | `database.types.ts` is UTF-16LE |

None of these blocked the build, which is why Phase 1 left them in place — fixing the `any` usages meant introducing typed error handling, a behavioral change outside Phase 1's build-only mandate. Phase 2 was scoped exactly to close this gap.

### After the Phase 2 fix

```
npm run build       → PASSES (built in 13.27s)
tsc -b --force       → PASSES, 0 errors (standalone type-check, no cache)
npm run lint         → PASSES, 0 errors, 0 warnings
npx vite             → dev server starts cleanly, ready in ~1.1s
```

Every lint error found after Phase 1 is resolved — see §13 for what changed and why. Also newly discovered and fixed during Phase 2: three `react-hooks/rules-of-hooks` errors in `Card.tsx` that Phase 1's lint-error table above had missed (undercounted 23 vs. the actual 26); these were the linter's view of the same conditional-hooks defect Phase 1 had already logged as bug B2.

Production bundle: `index.js` **890.69 kB** (271.97 kB gzip) — essentially unchanged; removing `react-day-picker`/`cmdk` barely moved the number because neither was reachable from any import graph, so tree-shaking had already excluded them. CSS dropped from 84.90 kB to **69.59 kB** (deleting `ui/command.tsx` removed its `cmdk`-specific utility classes from the Tailwind scan). The bundle is still a single 890 kB chunk with no route-level code splitting — that remains open (Phase 7, roadmap item 34).

### Dependency vulnerabilities

18 advisories (1 critical, 13 high, 2 moderate, 2 low), all in the dev/build toolchain rather than shipped runtime code — `@babel/core`, `@eslint/plugin-kit`, `ajv`, `brace-expansion`, `flatted`, `glob`, `js-yaml`, `minimatch`, `picomatch`, `postcss`, and others. `npm audit` reports fixes available. Not applied here: dependency bumps risk changing build output, which belongs in its own verifiable task.

---

## 6. Security Findings

### Positive

- The service-role key is **not** reachable from the browser: it is read from `Deno.env` inside the Edge Function, and `supabase/.env` names it `SERVICE_ROLE_KEY` with no `VITE_` prefix, so Vite will not inline it.
- `.env` and `supabase/.env` are both listed in `.gitignore`.
- Only the URL and anon key are exposed to the client, which is correct.
- The `delete-user` Edge Function verifies the caller's JWT with an anon-key client, then **rejects mismatched ids with 403** before using the admin client. Account deletion cannot target another user.
- Deletion order is correct: storage → database rows → auth user.
- Storage paths are namespaced per user (`${userId}/…`) and filenames are sanitized.
- Transaction mutations validate amount bounds and string lengths before hitting the database.

### Findings

| # | Severity | Finding |
|---|---|---|
| S1 | **High** | **Sign Out does not clear the session** (B1). On a shared or public device the next person can re-enter the account by navigating to `/dashboard`. |
| S2 | **High** | **RPC identity is caller-supplied.** All four data RPCs take a `uid`/`p_user_id` argument (`sum_income_amount(uid)`, `sum_expense_amount(uid)`, `sum_category_amount(uid, cat_id)`, `delete_user_everything(p_user_id)`) instead of deriving identity from `auth.uid()`. If any of these is `SECURITY DEFINER` without an internal `auth.uid()` check, any authenticated user can read another user's financial totals by passing a different uid. **This cannot be verified from the repository because no migrations exist** — it must be checked against the live database and then locked down. The spec explicitly forbids this pattern for AI tools. |
| S3 | **High** | **RLS, Storage, and view policies are unverifiable.** No `supabase/migrations/` directory exists. Whether RLS is enabled on `profiles`, `categories`, `transactions`, and `budgets`, whether global categories are write-protected, whether the `avatars` bucket restricts writes to the owner's folder, and whether `v_tx_search` is `security_invoker` are all unknown from the code. `deleteBudget` relies on RLS alone — it filters only by `id`, with no `user_id` predicate. |
| S4 | **Medium** | **PostgREST filter string interpolation.** `getExpenseCategories` and `listCategoriesAll` build `.or(\`user_id.eq.${userId},user_id.is.null\`)` by string concatenation. `userId` currently comes from the verified session so this is not presently exploitable, but the pattern is filter injection waiting for a less-trusted input. |
| S5 | **Medium** | **Edge Function CORS is `Access-Control-Allow-Origin: *`** on a credentialed, destructive endpoint. Should be restricted to known origins. |
| S6 | **Medium** | **Edge Function has no rate limiting** and takes `userId` from the request body. The equality check makes it safe today, but identity should be derived from the verified token rather than validated against user input. |
| S7 | **Low** | **Raw database errors are returned to the client.** The Edge Function forwards `rpcErr.message` and `delErr.message` verbatim, and the UI renders raw `error.message` in many branches — leaking schema and constraint details. |
| S8 | **Low** | **Avatars are stored in a public bucket** and served via public URLs. Filenames are unguessable (timestamp + UUID), so this is obscurity rather than access control. Acceptable for avatars; worth a conscious decision. |
| S9 | **Low** | **`SERVICE_ROLE_KEY` sits in plaintext at `supabase/.env`.** Correctly gitignored, but it should be documented as rotatable and never mirrored into any `VITE_`-prefixed variable. |
| S10 | **Low** | **No `.env.example`**, so required configuration is undiscoverable without reading source. |
| S11 | **Low** | **Destructive actions use `window.confirm`/`alert`** and are triggered from non-interactive `<span>` elements — no typed confirmation for account deletion, which permanently destroys all financial data. |

---

## 7. Frontend and Responsive-Design Findings

### Responsive

- **Layout is JavaScript-gated, not CSS-gated.** `useIsMobile()` returns `!!undefined` → `false` on the first render, so mobile devices paint the desktop layout for one frame before swapping. Mobile and desktop trees are mounted conditionally rather than via Tailwind breakpoints, which doubles the component surface and causes a visible flash.
- **The Dashboard chart is fixed-pixel.** `PieChart width={280} height={140}` inside a `w-[280px]` box, and `BudgetCard`'s is `width={200} height={100}`. Neither uses Recharts' `ResponsiveContainer`, so charts do not scale on narrow screens.
- **The Dashboard grid declares three columns but renders two widgets**, leaving a gap at `lg` and above.
- **No safe-area handling.** The viewport meta lacks `viewport-fit=cover`, and there are no `env(safe-area-inset-*)` paddings — content will sit under the notch and home indicator on iOS.
- **No tablet-specific layouts** and no orientation handling.
- Desktop tables *are* correctly wrapped in an `overflow-auto` container by `ui/table.tsx`, so the table itself will not force page-level horizontal scrolling.
- Mobile transaction cards and a bottom-sheet filter panel are genuinely implemented and are the strongest responsive work in the project.

### Accessibility

- **Destructive actions are not keyboard reachable.** "Delete User" and "Delete image" are `<span onClick=…>` with no `role`, `tabIndex`, or key handler. The `X` filter-removal icons in badges are also bare clickable SVGs.
- **Icon-only buttons lack accessible names** — the mobile menu trigger, the pagination arrows, and the avatar dropdown trigger have no `aria-label`.
- **The desktop account dropdown is hover-only** (`group-hover:visible`), so it cannot be opened by keyboard at all.
- **Native `<dialog>` elements have no `aria-labelledby`/`aria-describedby`** and no explicit focus management or focus restoration.
- **The `<dialog>` is opened imperatively via `getElementById`**, bypassing React, so screen-reader state and React state can diverge.
- **No reduced-motion support** — `animate-pulse`, `animate-bounce`, `animate-glow-pulse`, the phase-based landing animation, and the Dashboard typewriter all run regardless of `prefers-reduced-motion`.
- **Budget status is conveyed by gauge color alone** (green/yellow/red thresholds), with no text or icon equivalent — the spec explicitly forbids communicating financial status by color only.
- **Heading structure is inconsistent** — `Dashboard` renders its welcome text in a `<div>` rather than an `<h1>`, while widget titles are `<h3>`, so the page has `h3`s with no preceding `h1`.
- **Form labels are partly mismatched** — `Profile`'s Full Name uses `<Label htmlFor="fullName">` against an input with `id="fullname"` (case mismatch), and several `Select` controls have labels pointing at ids that Radix does not apply to a focusable element.
- **Hardcoded `text-white` on many controls** bypasses the theme tokens and will fail contrast if a light theme is ever added.
- Focus-visible rings *are* present in the shadcn `ui/` primitives.

### Performance

- **890 kB single bundle, no route lazy-loading.** All pages, Recharts, and all Radix primitives load on first paint.
- **Search and amount filters are not debounced** — they commit on blur/Enter, which avoids per-keystroke queries but makes filtering feel unresponsive.
- **Avatar re-fetch loop** (B8).
- **`refetchOnWindowFocus: "always"`** on totals re-queries on every tab focus regardless of staleness.
- **`TransactionNavbar` fetches the full unfiltered transaction list** via `useTransactions` purely to compute category counts, duplicating the filtered query already in flight.
- **`MobileTransactionCard` and `PaginationControls` are declared inside the `TransactionTable` body**, so they are recreated as new component types on every render, discarding their subtree state.
- **`daisyui` is still injected into the production CSS** despite being unused in live markup.
- **No database indexes are verifiable** (no migrations) for the columns actually filtered and sorted on: `transactions(user_id, created_at)`, `transactions(user_id, category_id)`, `budgets(user_id, year, month)`.

---

## 8. Supabase Findings

### Migrations — the central gap

`supabase/migrations/` **does not exist**. The `supabase/` directory contains only `config.toml`, `.env`, `.temp/` CLI state, and `functions/delete-user/`. Every schema object the application depends on — four tables, the `v_tx_search` view, five RPCs, all RLS policies, all Storage policies, and any indexes — exists only in the hosted project.

Consequences:
- The database cannot be recreated locally or in CI, so nothing about it can be reviewed or tested.
- RLS correctness (S3) and RPC authorization (S2) cannot be confirmed from the repository.
- `supabase db reset` would destroy the schema with nothing to rebuild from.

The first Supabase task must be to capture the current remote state into a baseline migration (`supabase db pull`) **without** resetting anything, then review what it reveals.

### Generated types

- `src/types/database.types.ts` is present and current enough to cover all four tables, the view, and all five functions.
- ~~It is **UTF-16LE encoded**, which breaks ESLint parsing (Section 5).~~ **Fixed in Phase 2** — re-encoded to UTF-8. This was a one-off byte-level fix on the existing file, not a regeneration; the next `supabase gen types typescript` run should be checked for its output encoding so the problem doesn't return.
- `categories.type` is typed `string` rather than a `'income' | 'expense'` enum, so the codebase casts at every use site. A Postgres enum or check constraint plus regenerated types would remove those casts.
- No `ai_conversations` / `ai_messages` types exist yet, as expected.

### Schema observations

- `transactions.category_id` and `budgets.category_id` are nullable, and `budgets` has no unique constraint on `(user_id, category_id, month, year)` — duplicate budgets for the same category and period are possible, which the spec forbids.
- `transactions` has no separate transaction-date column (Section 2).
- `profiles` lacks `currency`, `date_format`, `number_format`, and `theme` (Section 2).
- `profiles.timezone` and `is_valid_tz(tz)` exist, suggesting a validation constraint was intended; whether it is actually applied is unverifiable without migrations.
- `budget_reset_cycle` is a bare `string` with no enum or check constraint, while the UI restricts it to four values.

### Authentication flow

`supabase.auth.signUp` (with `full_name` metadata) → email confirmation → `signInWithPassword` → `getCurrentUser()` cached by React Query → `AuthGate` gate → `UserIdProvider`. Session persistence relies on `supabase-js` defaults (no explicit `persistSession`/`autoRefreshToken` configuration in `supabaseClient.ts`). There is no `onAuthStateChange` subscription, which is the root of B11. Profile row creation is presumably handled by a database trigger on `auth.users`, but no such trigger is visible in the repository — another thing only migrations would confirm.

### Storage

Bucket `avatars`, public URLs, per-user folders, sanitized filenames, `upsert: true`. Old avatar files are deleted on replace only via the explicit delete path — `useUploadAvatar` overwrites the `avatar_url` column without removing the previous object, so **orphaned files accumulate** on repeated uploads. Bucket policies are unverifiable (S3).

### RPC functions

| Function | Signature | Concern |
|---|---|---|
| `sum_income_amount` | `(uid)` → number | Caller-supplied identity (S2); no date range (P1) |
| `sum_expense_amount` | `(uid)` → number | Caller-supplied identity (S2); no date range (P1) |
| `sum_category_amount` | `(uid, cat_id)` → number | Caller-supplied identity (S2); no period (P2) |
| `is_valid_tz` | `(tz)` → boolean | Not called from the client |
| `delete_user_everything` | `(p_user_id)` → void | Called only with the service-role key after a 403 check; body unverifiable |

### Edge Functions

One function, `delete-user`. Authorization logic is sound (verify JWT → compare ids → 403 on mismatch → admin client). Weaknesses: wildcard CORS (S5), no rate limiting (S6), raw error passthrough (S7), an unpinned `esm.sh/@supabase/supabase-js@2` import, `Deno.env.get(...)!` non-null assertions with no startup validation, and `e?.message` accessed on an untyped `catch` binding.

---

## 9. AI Assistant Requirements

This section defines what must exist before the read-only assistant from `docs/MASTER_SPEC.md` can be built. **Nothing in this section was implemented.**

### 9.1 Blocking prerequisites

The assistant's core promise is *deterministic, period-correct, timezone-correct* financial answers. Three current facts make that impossible today:

1. **No period-aware aggregation exists.** Every aggregate RPC is all-time (P1, P2). The assistant must answer "this month", "last week", "June", and custom ranges — none of which the data layer can express.
2. **No timezone is applied anywhere.** `profiles.timezone` is stored and ignored (P4). Day, week, and month boundaries — which determine every answer — would silently use the server's or browser's zone.
3. **No migrations exist** (S3), so RLS cannot be confirmed. Pointing an AI at user financial data without verified row isolation is not acceptable.

Additionally, **S2 must be fixed first**: the spec states the assistant "must not select an arbitrary user ID", but every existing RPC takes exactly that. New tools must derive identity from `auth.uid()` server-side.

### 9.2 Required database work

New migrations will be needed for:

- **Period-aware, `auth.uid()`-scoped SQL functions** replacing the `uid`-parameterized ones, accepting `(start_ts, end_ts)` and resolving identity internally.
- **Timezone-correct boundary helpers** so day/week/month math happens in the user's zone (`AT TIME ZONE profiles.timezone`).
- **`profiles` additions** — `currency`, `date_format`, `number_format`, `theme`, plus AI preferences (whether to retain conversations, retention window).
- **`ai_conversations`** — `id`, `user_id`, `title`, `created_at`, `updated_at`; RLS restricting to owner.
- **`ai_messages`** — `id`, `conversation_id`, `user_id`, `role`, `content`, `metadata`, `created_at`; RLS restricting to owner.
- **`ai_usage`** — per-user request counters for rate and quota enforcement.
- **`delete_user_everything` extension** so conversations and messages are included in account deletion.
- **Indexes** on `transactions(user_id, created_at)`, `transactions(user_id, category_id)`, `budgets(user_id, year, month)`, `ai_messages(conversation_id, created_at)`.
- **A unique constraint** on `budgets(user_id, category_id, month, year)`.

### 9.3 Required deterministic tools

The spec names twelve. Mapping them to what exists:

| Tool | Status |
|---|---|
| `get_user_preferences` | Partially — `profiles` read exists; currency/format columns missing |
| `get_income_total` | Rewrite — `sum_income_amount` has no date range or `auth.uid()` scoping |
| `get_expense_total` | Rewrite — same |
| `get_net_income` | New (derivable from the two above) |
| `get_financial_summary` | New |
| `get_budget_status` | Rewrite — `sum_category_amount` has no period |
| `get_category_spending` | New — `v_tx_search` provides the join, but no aggregation exists |
| `get_merchant_spending` | New — `merchant` is stored but never aggregated |
| `compare_periods` | New — must suppress percentages near zero, per spec |
| `get_recent_transactions` | Partially — `transactionsWithFilters` is close but client-side and 50-capped |
| `find_spending_anomalies` | New — no statistical baseline of any kind exists |
| `get_report_data` | New — the Reports page it should mirror is empty |

Every one must return values computed in SQL or server code, never estimated by the model.

### 9.4 Required backend

A second Edge Function (e.g. `ai-assistant`) following the pattern the existing `delete-user` function already gets right — verify the JWT, derive the user id from the verified session, reject unauthenticated requests — plus, per spec: request-size limits, per-user rate limiting, timeouts, safe retries, sanitized errors, streaming support, and no financial detail in logs. The AI provider key must live only in Edge Function environment variables and must never carry a `VITE_` prefix.

A provider abstraction should separate model configuration, assistant instructions, financial tools, conversation state, safety rules, streaming, usage limits, and error handling, so the provider can be swapped without touching the tools or UI.

### 9.5 Required frontend

- An `/assistant` route added to the nav (`Dashboard, Transactions, Budgets, Reports, Assistant, Settings`) — note that the nav is currently driven by parallel `NavNames`/`NavTo` arrays in `AppLayout`, a fragile pattern worth replacing with a single route-config array before adding entries.
- A full conversational page: message list, starter questions, streaming indicator, error and empty states, new-conversation control, history, retry, copy, and links back to related transactions/budgets/reports.
- A Dashboard entry point and per-chart "Explain this chart" actions on Reports (which must exist first).
- Full-screen on phones; split or side-panel on tablets; both orientations.
- Accessible message status announcements, keyboard navigation, and mobile-safe input.
- Graceful degradation: the app must stay fully usable when the assistant is unavailable.

### 9.6 Privacy decisions to make explicit

Whether conversations are stored, where, for how long, whether users can delete them, whether they are included in account deletion, and how much financial data is sent per request. The spec's preference is minimum necessary data — send computed results and the supporting categories, not raw transaction history.

---

## 10. Prioritized Implementation Roadmap

Ordered to match `docs/MASTER_SPEC.md` §"Implementation Order", adjusted for what this audit found. Each item is intended to be a separate, independently verifiable task.

### Phase 1 — Stabilize ✅
1. ✅ Fix the 14 build-blocking TypeScript errors. `npm run build` passes; dev server starts.

### Phase 2 — Make the toolchain trustworthy ✅ (mostly)
2. ✅ Re-encode `database.types.ts` as UTF-8 so ESLint can parse it. *(Done as a byte-level conversion, not a regeneration — see §8.)*
3. ✅ Clear the remaining 26 lint errors: added a typed `getErrorMessage(unknown)` helper for `catch` blocks and switched `.error` access to TanStack Query's default `Error` typing, moved `badgeVariants`/`buttonVariants` into sibling modules, split `userIdContext.tsx`'s hooks into `useUserId.ts`, fixed the `no-useless-escape` and empty-interface errors (by deleting the dead file that had it), and fixed 3 `react-hooks/rules-of-hooks` errors discovered along the way (the lint-level view of bug B2).
4. ✅ **Done in Phase 3** — Vitest + React Testing Library + jest-dom + user-event + jsdom installed and configured, `test`/`test:watch`/`test:coverage` scripts added, 14 foundational tests passing. See §15–16.
5. ✅ Removed dead code: `src/hooks/useAvatar.ts`, `src/components/ui/dialog.tsx` **and** `src/components/ui/command.tsx` (found to be dead alongside it), ~250 lines of commented-out legacy markup, and 5 stray debug `console.log`s. Declared `date-fns` explicitly; dropped unused `react-day-picker` and `cmdk`. **`daisyui` was kept** — it is still live via `text-base-content` (see §4.5).
6. ❌ **Not done** — no `.env.example`, README is still the unmodified Vite template. Deferred; not a lint/build/startup error.

### Phase 3 — Automated testing foundation ✅
Added ahead of the frontend revamp per the approved `docs/FRONTEND_REVAMP_PLAN.md`: "add the automated test foundation before beginning the frontend implementation." See §15–16 for what was added and why. This phase intentionally did not write page-component tests, redesign any UI, or touch Supabase — it exists so the revamp's component-by-component work (§13–15 of the revamp plan) has a runner and a small set of conventions to build on from day one.

### Phase 3 — Capture and secure Supabase *(highest risk; do before any AI work)*
7. `supabase db pull` into a baseline migration. **Non-destructive — do not reset.**
8. Audit what the baseline reveals: confirm RLS is enabled on all four tables and that policies are owner-scoped; confirm global categories (`user_id IS NULL`) are read-only to users; confirm `avatars` bucket policies restrict writes to `${auth.uid()}/`; confirm `v_tx_search` is `security_invoker`.
9. **Fix S2** — rewrite the four data RPCs to derive identity from `auth.uid()` instead of accepting a `uid` argument, and add period parameters at the same time (fixes P1/P2). Migration + regenerated types.
10. Harden the Edge Function: restrict CORS, derive the user id from the verified token, add rate limiting, sanitize error responses, pin the `esm.sh` import.
11. Replace the `.or()` string interpolation in `categories.ts` with `.in()`/composed filters (S4). Add a `user_id` predicate to `deleteBudget` alongside RLS.
12. Add the missing constraints and indexes: unique `budgets(user_id, category_id, month, year)`, an enum or check on `categories.type` and `budget_reset_cycle`, and the indexes listed in §9.2.

### Phase 4 — Fix correctness bugs
13. **B1** — implement real sign-out (`supabase.auth.signOut()`, clear the query cache, redirect) and add an `onAuthStateChange` subscription for expired-session handling (B11).
14. **B2** — move `BudgetCard`'s hooks above the early return.
15. **B6** — move pagination server-side using `count: 'exact'` so totals and page counts are real.
16. **B3** — make the date-range filter end-exclusive at end-of-day so single-date selection works.
17. **B4, B5, B7, B8, B9, B10, B12** — the remaining defects in §4.1.
18. **P4, P5** — centralize formatting in a single module that reads the user's timezone and currency from `profiles`, and route every date and money render through it.

### Phase 5 — Complete the product surface
19. Refactor the oversized modules: split `Navbar.tsx` into `AppNav` + `TransactionFilterBar`; split `FieldSet.tsx` into four form modules; extract `TransactionTable`'s inner components to module scope; replace the parallel-array nav props with a route-config array. Rename `userUser.ts` → `useUser.ts`.
20. Complete authentication: forgot password, reset password, password visibility, verification resend, safe redirects.
21. Complete the responsive shell: CSS-breakpoint layouts instead of `useIsMobile` gating, `viewport-fit=cover`, safe-area insets, `ResponsiveContainer` for all charts.
22. Complete transactions and categories: user-selectable transaction date/time (needs a schema decision on `created_at` vs a new column), debounced search, and a real category management UI with rename and safe delete.
23. Correct budget calculations against the reporting period; add period navigation and duplicate prevention.
24. Build the Reports page — the largest single piece of missing product.
25. Complete Profile/Settings: add the `currency`/`date_format`/`number_format`/`theme` columns and wire the disabled controls to them; add password-reset access and sign-out; replace `confirm`/`alert` with accessible dialogs and a typed confirmation for account deletion.
26. Improve the Dashboard to the spec's twelve elements; replace the `"JV DUMPY"` placeholder branding with **Nexali**, the personal-email placeholders, the page title, and the favicon.
27. Accessibility pass: keyboard-reachable destructive actions, `aria-label`s on icon buttons, a keyboard-openable account menu, dialog labelling and focus management, `prefers-reduced-motion`, non-color budget status indicators, and heading hierarchy.

### Phase 6 — AI Assistant *(only after Phases 3 and 4)*
28. Define the assistant architecture and privacy/retention policy.
29. Migrations for `ai_conversations`, `ai_messages`, `ai_usage`, AI profile preferences, and the extension of `delete_user_everything`.
30. Build the twelve deterministic read-only tools (§9.3) on top of the now-`auth.uid()`-scoped, period-aware, timezone-correct SQL layer.
31. Build the authenticated `ai-assistant` Edge Function with the provider abstraction, rate limits, timeouts, and sanitized errors.
32. Build the Assistant interface; add entry points from Dashboard and Reports.
33. Test assistant authentication, user isolation, date interpretation, totals, category ranking, period comparison, anomaly detection, budget explanations, rate limits, unavailable states, and refusal to modify data.

### Phase 7 — Ship
34. Performance: lazy-load routes to break up the 890 kB bundle, optimize the 219 kB avatar placeholder, remove the redundant unfiltered transactions query.
35. PWA: manifest, icons, theme color, standalone display, service worker, offline fallback, update handling — with no caching of financial data or AI responses.
36. Capacitor preparation: config, safe areas, status bar, splash, keyboard, deep links, auth redirects, back-button behavior.
37. Address the 18 dependency advisories in a dedicated task with a full build/lint/test verification.
38. Final documentation and production review.

---

## 11. Changes Made in Phase 1

Only build-blocking errors were fixed. No behavior, styling, layout, or data flow was altered.

| File | Change |
|---|---|
| [src/components/FieldSet.tsx](src/components/FieldSet.tsx) | Removed unused `X` import, unused `./ui/select` import, unused `@radix-ui/react-select` import; removed unused `catOptions` destructuring (kept `catsLoading`/`catsError`/`catsErrorObj`, which are used) |
| [src/components/Modal.tsx](src/components/Modal.tsx) | Removed the unused `./ui/dialog` import |
| [src/components/TransactionTable.tsx](src/components/TransactionTable.tsx) | Removed unused `useTransactions` import; removed the unused `hasActiveFilters` local |
| [src/components/ui/calendar.tsx](src/components/ui/calendar.tsx) | Removed the unused default `React` import (kept `useState`); removed the unused `numberOfMonths` destructuring (the prop remains in `CalendarProps`, so existing callers still type-check) |
| [src/LandingPage.tsx](src/LandingPage.tsx) | Removed unused `Shield` and `Smartphone` icon imports |
| [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) | Removed the unused `COLORS` constant (referenced only from commented-out legacy code) |
| [src/pages/Profile.tsx](src/pages/Profile.tsx) | Removed the unused `dateFormat`/`setDateFormat` state — no Date Format control is rendered, so this was dead. Adding that control is tracked as roadmap item 25. |
| [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md) | New file (this report) |

No migrations were created. No database operations of any kind were performed. No secrets were read into output, modified, or committed.

---

## 12. Verification (Phase 1)

| Command | Before | After |
|---|---|---|
| `npm install` | up to date, 407 packages, 18 advisories | unchanged |
| `npm run build` | **FAIL** — 14 TS errors | **PASS** — built in 13.46s |
| `npm run lint` | **FAIL** — 44 errors | 26 errors (all non-blocking; see §5) |
| `npx vite` (dev server) | starts | starts, ready in ~1.1s |
| tests | no runner, no script, no test files | unchanged — roadmap item 4 |

---

## 13. Changes Made in Phase 2

Goal: fix every remaining build/TypeScript/lint/startup error and its underlying cause, and remove the dead code, debug statements, and dependency drift Phase 1 identified but deliberately left untouched. No redesign, no new product features, no AI Assistant, no destructive database operations.

### Root-cause fixes (not suppressions)

| File | Change |
|---|---|
| [src/lib/utils.ts](src/lib/utils.ts) | Added `getErrorMessage(error: unknown, fallback?): string` — narrows `Error`/`string`, otherwise returns the fallback. Used everywhere a `catch` block needed a safe message instead of an `any` cast. |
| [src/components/Card.tsx](src/components/Card.tsx) | Moved `BudgetCard`'s early `if (!categories) return null` to *after* all hook calls (fixes bug B2 and the `react-hooks/rules-of-hooks` errors it produced); typed the Recharts `Tooltip` `formatter` value as `number` instead of `any`; removed a ~24-line commented-out legacy JSX block. |
| [src/features/budgets/useSpentAmount.ts](src/features/budgets/useSpentAmount.ts) | `categoryId` now accepts `number \| undefined` with `enabled: categoryId != null`, so `BudgetCard` can call the hook unconditionally (required by the B2 fix above) without firing a network request for a budget with no category. |
| [src/components/CategoryPicker.tsx](src/components/CategoryPicker.tsx) | Removed an unnecessary `(res as any).id` cast — `res` was already typed `{ id: number }` by `useCreateCategory`. |
| [src/components/FieldSet.tsx](src/components/FieldSet.tsx) | Fixed 4 `any` usages (removed unnecessary casts on typed `.error` objects; `getErrorMessage` in one `catch` block; dropped an unneeded manual `: any` annotation on a mutation `onError` callback, letting TypeScript infer the correct type). Removed a ~70-line commented-out legacy `<fieldset>` block. |
| [src/components/TransactionTable.tsx](src/components/TransactionTable.tsx) | Fixed 2 `any` usages the same way. |
| [src/lib/budgets.ts](src/lib/budgets.ts) | Fixed the `catch (e: any)` in `getBudgets`; kept the existing `console.error` (legitimate — the function degrades to `[]` on failure) but typed the message via `getErrorMessage`. |
| [src/pages/Budgets.tsx](src/pages/Budgets.tsx) | Fixed 1 `any`; removed a ~40-line commented-out legacy block. |
| [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) | Fixed 1 `any`; removed a ~75-line commented-out legacy block. |
| [src/pages/Profile.tsx](src/pages/Profile.tsx) | Fixed 4 `any` usages, including the `!LIST.includes(timezone as any)` cast — replaced with `!(LIST as readonly string[]).includes(timezone)`, the standard fix for TypeScript narrowing a `readonly` string-literal tuple's `.includes()` to a wider string. Removed a ~100-line commented-out legacy block. |
| [src/lib/storage.ts](src/lib/storage.ts) | `[^\w.\-]` → `[^\w.-]` — the hyphen is already last in the character class, so escaping it was unnecessary. |
| [src/lib/transactions.ts](src/lib/transactions.ts) | Removed two stray debug `console.log`s (one with a literal leftover `// Add this line` comment). |
| [src/features/transactions/useTransactions.ts](src/features/transactions/useTransactions.ts) | Removed two stray success-path `console.log`s (kept the `console.error` calls in the corresponding `onError` handlers); removed the now-unused `action` local that existed only to feed one of the removed logs. |
| [src/LandingPage.tsx](src/LandingPage.tsx) | Removed the per-render `console.log("Phase:", animationPhase)`. |

### `react-refresh/only-export-components` (5 errors) — component/hook file splits

The rule fires when a file exports a React component alongside anything that isn't one. Each fix moved the non-component exports to a sibling file rather than disabling the rule:

| Before | After |
|---|---|
| [src/components/ui/badge.tsx](src/components/ui/badge.tsx) exported `Badge` and `badgeVariants` | `badgeVariants` moved to new [src/components/ui/badge-variants.ts](src/components/ui/badge-variants.ts); `badge.tsx` now exports only `Badge` |
| [src/components/ui/button.tsx](src/components/ui/button.tsx) exported `Button` and `buttonVariants` | `buttonVariants` moved to new [src/components/ui/button-variants.ts](src/components/ui/button-variants.ts); `button.tsx` now exports only `Button` |
| [src/shared/userIdContext.tsx](src/shared/userIdContext.tsx) exported the `UserIdProvider` component plus three hooks (`useUserInfo`, `useUserId`, `useMaybeUserId`) | The context object moved to new [src/shared/userContext.ts](src/shared/userContext.ts) (no JSX, no component — exempt from the rule); `userIdContext.tsx` now exports only `UserIdProvider`; the three hooks moved to new [src/shared/useUserId.ts](src/shared/useUserId.ts) (a hooks-only file — also exempt) |

Neither `badgeVariants` nor `buttonVariants` was imported anywhere outside its own file, so no other call sites changed. The three hooks' behavior is byte-for-byte identical, just relocated — all 7 call sites across `Navbar.tsx`, `FieldSet.tsx`, `TransactionTable.tsx`, `Card.tsx`, `Budgets.tsx`, `Profile.tsx`, and `Dashboard.tsx` were updated to import `useUserInfo` from `../shared/useUserId` instead of `../shared/userIdContext`.

### Dead-file deletions

| File | Why |
|---|---|
| `src/hooks/useAvatar.ts` | Unreferenced duplicate of `src/features/profiles/useAvatar.ts` (confirmed via grep — zero importers). |
| `src/components/ui/dialog.tsx` | Only remaining consumer was `ui/command.tsx`, which is itself dead (below). `@radix-ui/react-dialog` stays as a dependency because `ui/sheet.tsx` — the live mobile-nav sheet — is built directly on it, independent of this wrapper. |
| `src/components/ui/command.tsx` | Confirmed unreferenced anywhere in the app (grepped for `ui/command` imports and for `CommandDialog`/`CommandInput`/`CommandList` usage — zero hits outside the file itself). Its `interface CommandDialogProps extends DialogProps {}` was the `@typescript-eslint/no-empty-object-type` error; deleting the dead file removed the error at its source instead of patching an interface nothing used. |

### `database.types.ts` re-encoding

The file was UTF-16LE with a BOM (confirmed via raw byte inspection: `FF FE 0D 00 0A 00 …`). Converted to UTF-8 without BOM via a Node one-off script that decoded the buffer as `utf16le`, stripped the leading `﻿`, and rewrote it as `utf8`. Content is unchanged — verified line-for-line after conversion.

### `package.json` / `package-lock.json`

- Added `"date-fns": "^4.1.0"` as a direct dependency — it was imported by `Navbar.tsx` but only resolved transitively through `react-day-picker`, which is now removed.
- Removed `"cmdk"` (only used by the now-deleted `ui/command.tsx`) and `"react-day-picker"` (superseded by the hand-rolled `ui/calendar.tsx`; confirmed zero imports).
- Ran `npm install` to sync `package-lock.json`; 4 packages removed, no new vulnerabilities introduced (18 advisories, unchanged — all pre-existing dev-toolchain advisories per §5, not touched by this task).

### Explicitly not touched, and why

- **`daisyui` Tailwind plugin/dependency** — the Phase 1 audit flagged it as dead. A verification grep for daisyUI-specific class names (not just component classes like `btn`/`modal-box`) found `text-base-content` live and unstyled-by-comment-removal in `FieldSet.tsx`, `TransactionTable.tsx`, and `Profile.tsx`. Removing the plugin would have been a visual regression, which is explicitly out of scope. Kept.
- **Test runner** — adding one is tooling, not an error fix; deferred per the task's scope (fix errors, not add infrastructure).
- **`pathFromPublicUrl` triplication, oversized components (`Navbar.tsx`, `FieldSet.tsx`), misleading module names** — all still present. None of these produce a build, TypeScript, lint, or startup error; fixing them is a structural refactor with real regression risk, explicitly deferred to Phase 5 of the roadmap.
- **`.env.example`, README rewrite** — not errors; deferred.

No migrations were created. No database operations of any kind were performed. No secrets were read into output, modified, or committed. No product features were added or removed, and no page's visual output or user-facing behavior changed except: (1) `BudgetCard` no longer risks a React hooks-order crash for a budget with a deleted category, and (2) a handful of error messages that previously read `"Something went wrong"` under specific non-`Error` throw shapes now read the same via a named helper instead of an inline `?? "fallback"` — the displayed strings are identical.

---

## 14. Verification (Phase 2)

| Command | Before this task | After this task |
|---|---|---|
| `npm install` | 407 packages, 18 advisories | 403 packages, 18 advisories (unchanged; `cmdk`/`react-day-picker` removal was the only dependency change) |
| `npm run build` | PASS, 890.92 kB JS / 84.90 kB CSS | **PASS** — built in 13.27s, 890.69 kB JS / **69.59 kB CSS** |
| `tsc -b --force` (standalone, no cache) | not run separately | **PASS** — 0 errors |
| `npm run lint` | 26 errors | **PASS** — 0 errors, 0 warnings |
| `npx vite` (dev server) | starts, ready in ~1.1s | starts, ready in ~1.1s (confirmed again after all changes) |
| tests | no runner, no script, no test files | **unchanged** — still the top remaining gap |

Final sanity sweep after all edits: zero remaining `: any` / `as any` in `src/`; the 8 remaining `console.*` calls are all `console.error`/`console.warn` in genuine error-handling branches (verified individually, listed in §13); `database.types.ts` starts with `0D 0A 65 78` (`\r\nex…`) — valid UTF-8, no BOM.

---

## 15. Changes Made in Phase 3 — Automated Testing Foundation

Goal: add a working test runner and a small set of foundational tests for stable existing behavior, so the approved `docs/FRONTEND_REVAMP_PLAN.md` can proceed with tests written alongside each page as it's rebuilt, rather than retrofitted afterward. No page component was refactored, no Supabase/backend behavior was touched, no AI Assistant work was done, and the frontend redesign itself was not started.

### Dependencies added (all `devDependencies`)

| Package | Installed version | Why |
|---|---|---|
| `vitest` | `^4.1.10` | Test runner — reuses the existing Vite pipeline (transforms, plugins, path resolution) instead of adding a second, differently-configured build tool |
| `@vitest/coverage-v8` | `^4.1.10` | V8-native coverage for `vitest run --coverage` — no source instrumentation/Babel step required |
| `jsdom` | `^30.0.1` | DOM environment for component tests (Vitest doesn't bundle an environment by default) |
| `@testing-library/react` | `^16.3.2` | Component rendering/querying — this version supports React 19, which the app already uses |
| `@testing-library/jest-dom` | `^7.0.0` | DOM-specific matchers (`toBeInTheDocument`, `toBeDisabled`, `toHaveValue`, etc.) |
| `@testing-library/user-event` | `^14.6.1` | Realistic user interaction simulation (click, type) instead of firing raw DOM events |

No test-only UI/mocking framework (e.g., MSW) was added — not needed for the four tests in this phase and would be premature before the revamp's data-fetching test needs are known. No `@types/node` was needed — nothing in the config touches Node built-ins. Chosen exactly to match the task's "preferably: Vitest, RTL, jest-dom, user-event, jsdom" list and nothing beyond it, per "avoid adding unnecessary testing dependencies."

### Configuration files added or changed

| File | Change |
|---|---|
| [vite.config.ts](vite.config.ts) | `defineConfig` import switched from `'vite'` to `'vitest/config'` (a superset re-export — same Vite config type plus a typed `test` field; this is the officially recommended way to keep one config file instead of a second `vitest.config.ts`). Added `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false, coverage: { provider: 'v8', reporter: ['text', 'html'], exclude: [...] } }`. |
| [src/test/setup.ts](src/test/setup.ts) | New. Imports `@testing-library/jest-dom/vitest` (registers the jest-dom matchers on Vitest's `expect`, including the TypeScript type augmentation, without needing a separate `types` array entry in `tsconfig`) and registers `afterEach(() => cleanup())` so each test unmounts its rendered tree — required because `test.globals` is intentionally **off** (see below), so React Testing Library's own auto-cleanup detection (which only fires if it finds a *global* `afterEach`) doesn't trigger on its own. |
| [package.json](package.json) | Added `test`, `test:watch`, `test:coverage` scripts (below) and the six dependencies above. |
| [.gitignore](.gitignore) | Added `coverage` — the coverage report directory `vitest run --coverage` generates, alongside the existing `dist`/`node_modules` entries. |

**Deliberate config choice — no global test APIs.** `test.globals` was left at its default (`false`). Every test file explicitly imports `describe`/`it`/`expect`/`vi`/`afterEach` from `'vitest'` rather than relying on ambient globals. This matches the codebase's existing style (no ambient globals anywhere else — `verbatimModuleSyntax: true` in `tsconfig.app.json` already enforces explicit, non-ambient imports throughout) and avoids two knock-on config changes that enabling globals would have required: adding `"vitest/globals"` to `tsconfig.app.json`'s `types` array, and adding a `vitest`-aware globals entry to `eslint.config.js` (otherwise ESLint's `no-undef` rule, active via `js.configs.recommended`, would flag every bare `describe`/`it`/`expect` as an undefined reference). Zero `eslint.config.js` or `tsconfig.*.json` changes were needed as a result.

### Tests added (14 tests across 4 files, all co-located next to the code they test)

| File | What it covers |
|---|---|
| [src/components/ui/button.test.tsx](src/components/ui/button.test.tsx) | The shared `Button` component (requirement: "Rendering the shared Button component"). Renders with an accessible name via `getByRole('button', { name })`; fires `onClick` on a real user click (via `user-event`, not a synthetic DOM event); confirms `disabled` both sets the DOM `disabled` attribute and actually blocks the click handler from firing. |
| [src/components/ui/input.test.tsx](src/components/ui/input.test.tsx) | `Input` paired with the existing `Label` component (requirement: "Rendering an Input with an accessible label"). Confirms the input is reachable via `getByLabelText` (i.e., the `htmlFor`/`id` association actually works — this is a direct regression guard for the exact `htmlFor`/`id` mismatch bug already logged against `Profile.tsx` in §4.5/§6.4/§7, and now the class of bug it represents has a test pattern to reuse there once Profile is rebuilt); confirms typed input reflects in the field's value; confirms `disabled` propagates correctly. |
| [src/lib/format.ts](src/lib/format.ts) + [src/lib/format.test.ts](src/lib/format.test.ts) | Requirement: "One existing financial formatting or calculation utility." **This one needed a judgment call — see the callout below.** `formatCurrency(amount, currency?, locale?)` wraps `Intl.NumberFormat` with `style: 'currency'`, generalizing the exact ad hoc pattern already used inline in `Dashboard.tsx` (`new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })`) into one named, exported, pure function. Tests cover default USD formatting, two-decimal rounding (`9.999` → `"$10.00"`), zero, negative amounts (leading minus sign), and a non-default currency/locale pair (EUR/de-DE). |
| [src/AuthGate.test.tsx](src/AuthGate.test.tsx) | Requirement: "One basic authentication-loading or protected-route behavior, if it can be tested without a large refactor." Tests the real `AuthGate` component (no source changes to `AuthGate.tsx`, `useUser`, or `getCurrentUser`) with `../supabaseClient`'s `supabase.auth.getUser` mocked via `vi.mock`, wrapped in a real `QueryClientProvider` + `MemoryRouter`/`Routes`. Three cases: shows `"Loading account…"` while the session check is pending; redirects to `/signin` (verified by asserting the `/signin` route's content renders) when `getUser` resolves with no user; renders the protected children once a user resolves successfully. |

**Judgment call flagged for your review — the `formatCurrency` utility.** No pure, already-exported "financial formatting or calculation" function existed anywhere in the codebase to test as-is: the two closest candidates (`Dashboard.tsx`'s `safePct` and `Card.tsx`'s `BudgetCard`-local `getColor`) are both defined *inside* component function bodies, not exported, and extracting either would have meant editing a page component (`Dashboard.tsx`) or a component that renders financial figures (`Card.tsx`) — the former explicitly forbidden by this task ("do not refactor page components"), the latter carrying needless risk for a testing-infrastructure task. Rather than stretch the requirement onto an unrelated existing utility (e.g. `getErrorMessage`, which isn't financial) or skip it, a small new pure function was added to `src/lib/` — the same directory `docs/DESIGN_SYSTEM.md` §3.2 and `docs/FRONTEND_REVAMP_PLAN.md` §6.7/§14 already call for a centralized formatting module to live in. It is **not imported or wired into any component** — it exists solely as tested, ready-to-adopt foundation for the revamp, with zero effect on current app behavior. If you'd rather this function not exist until the revamp actually needs it, it can be deleted along with its test with no other changes required — nothing depends on it yet.

### Test scripts added

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

`test` runs once and exits (CI-appropriate). `test:watch` is the interactive/watch-mode entry point for local development. `test:coverage` runs once with the V8 coverage reporter.

### A note on the CSS bundle size

The production build's CSS output grew from 69.59 kB to 71.26 kB (JS bundle is unchanged at 890.69 kB — test files are never imported by application code, so they cannot and do not affect the shipped JS). This is because `tailwind.config.js`'s `content` glob (`./src/**/*.{js,ts,jsx,tsx}`) is a plain text scan for class-name literals, not an import-graph analysis, so it now also scans the four new `*.test.tsx`/`*.test.ts` files. None of those files introduce a Tailwind class that wasn't already present in the components they render (`Button`, `Input`, `Label`), so this is very likely Tailwind/PostCSS's internal ordering or minification varying slightly between full rebuilds rather than a real new-styles addition — but it wasn't chased further since it's a ~1.7 kB, non-functional difference and outside this task's scope. If it's worth eliminating precisely, the fix is a one-line addition to `tailwind.config.js`'s `content` array (e.g. an `!./src/**/*.test.{ts,tsx}` exclusion) — not done here to keep this task's diff scoped to the testing stack itself.

---

## 16. Verification (Phase 3)

| Command | Result |
|---|---|
| `npx tsc -b --force` (standalone, no cache) | **PASS** — 0 errors |
| `npm run lint` | **PASS** — 0 errors, 0 warnings |
| `npm run build` | **PASS** — built in ~15s, 890.69 kB JS / 71.26 kB CSS (see CSS note above) |
| `npm run test` | **PASS** — 4 test files, **14 tests**, all passing |
| `npm run test:coverage` | **PASS** — same 14 tests; V8 coverage report generated (`text` + `html`, in a gitignored `coverage/` directory) |

### Coverage snapshot

Coverage is necessarily low overall (~52% statements) because it's measured against the *entire* `src/` tree while only 4 files have tests so far — this is expected and by design; coverage percentage is not a target for this phase, the presence of a working, accurate coverage pipeline is. Per-file coverage for everything actually exercised by a test:

| File | Statements |
|---|---|
| `src/lib/format.ts` | 100% |
| `src/components/ui/button.tsx` | 100% |
| `src/AuthGate.tsx` | 87.5% (the two uncovered lines are the `isError` branch and the `UserIdProvider`-wrapped success-children path beyond what the third test asserts — not exercised because no test currently forces `useUser`'s query into an error state; a reasonable follow-up test, not added here to keep this phase's test count deliberately small per "a small set of foundational tests") |

One cosmetic-only observation: `format.ts` didn't appear in the terminal's `text` coverage table despite being 100% covered — confirmed via the raw `coverage-summary.json` that its data is present and correct; this is a display quirk of the `text` reporter's directory grouping, not a coverage or config defect, and the `html` reporter (also configured) shows it correctly.

### Remaining testing limitations

- **No tests exist yet for any page component** (`Dashboard`, `Transactions`, `Budgets`, `Reports`, `Profile`, `SignIn`, `SignUp`, `LandingPage`) or any of the larger shared components (`Navbar`, `FieldSet`, `TransactionTable`, `Card`) — by design; this phase is the foundation, not the coverage. `docs/FRONTEND_REVAMP_PLAN.md` §15 already specifies where component/interaction tests should be added as each page is rebuilt.
- **No mocking layer for Supabase beyond a single hand-rolled `vi.mock`** — fine for one component test; if the revamp's page-level tests need to mock several different Supabase calls (auth, RPCs, storage, the `v_tx_search` view) consistently, a small shared test-mock helper is worth adding at that point, not preemptively now.
- **No end-to-end/browser testing tool** (e.g., Playwright) — `docs/MASTER_SPEC.md`'s testing section calls for "Unit tests, Integration tests, End-to-end tests, Manual responsive testing." This phase covers the unit-test layer only, per this task's explicit scope. E2E tooling is a separate, larger decision (browser matrix, CI runner implications) better made once real user flows exist to test against post-revamp, not before.
- **No visual regression / responsive-breakpoint testing tool** — `docs/FRONTEND_REVAMP_PLAN.md` §15 notes a small number of viewport-width layout assertions will be worth adding once the `isMobile`-branching refactor lands; no such tool was added here since there's nothing yet to test against.
- **Coverage thresholds are not enforced** — `vite.config.ts`'s `test.coverage` config has no `thresholds` block, so `test:coverage` reports but never fails a run for being "too low." Deliberately left unenforced at this stage — an enforced threshold makes sense once the revamp starts adding real coverage, not while the codebase is still mostly untested by design.

### Explicitly not done, and why

- **Page component tests** — the task explicitly says not to refactor page components, and testing a page in its current pre-revamp form would mean writing tests against markup that's about to be rebuilt per the approved `docs/FRONTEND_REVAMP_PLAN.md` — wasted work.
- **Supabase/backend changes of any kind** — no migration, RLS policy, RPC, or Edge Function was touched, consistent with the task's constraints.
- **AI Assistant implementation** — not started; only referenced in the (unmodified) planning docs.
- **Frontend redesign** — not started; the four tests added exercise components exactly as they exist today.
