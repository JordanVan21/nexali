# Frontend Revamp Plan

**Status:** Planning only. No application code, backend logic, database schema, authentication behavior, or Supabase configuration was modified to produce this document.
**Companion document:** `docs/DESIGN_SYSTEM.md` — the color/typography/spacing/component-state vocabulary this plan builds on.
**Prerequisite state:** `docs/AUDIT_REPORT.md` Phases 1–2 are complete — the build, TypeScript, and lint are clean. **Phase 3 (testing foundation) is also now complete** — Vitest, React Testing Library, `@testing-library/jest-dom`, `@testing-library/user-event`, and jsdom are installed and configured, with `test`/`test:watch`/`test:coverage` scripts and 14 passing foundational tests. Full detail in `docs/AUDIT_REPORT.md` §15–16. This plan starts from that stable, now test-capable baseline — §15 below is updated accordingly.
**Do not implement from this plan yet.** Section 12 lists the visual decisions that need your approval, and the Stitch screens in Section 11 need to be produced and selected, before any implementation branch starts.

---

## 1. Scope and Constraints

Per `CLAUDE.md` and `docs/MASTER_SPEC.md`:

- Preserve the existing Supabase architecture, React Query data layer, and routing structure — this is a **visual and structural frontend revamp**, not a rewrite. Working data-fetching code (`features/`, `lib/`) is out of scope except where a component split requires moving a hook call, not changing what it does.
- Mobile-first, responsive across phone/tablet/laptop/desktop, installable as a PWA, Capacitor-ready — all per the spec's requirements.
- The first-version AI Assistant is **read-only** and must have a designed place in the navigation and Dashboard now, even though it isn't built yet.
- Work proceeds **one phase at a time** — this plan proposes a page-by-page sequence (§13) precisely so implementation can be split into reviewable, revertible increments rather than one large rewrite.
- This document does not implement anything. It audits, inventories, and proposes.

---

## 2. Method

This audit is based on a line-by-line read of every page component, every shared component, every `ui/` primitive, `index.css`, and `tailwind.config.js` as they exist today (post-stabilization — see `docs/AUDIT_REPORT.md`), cross-referenced against `docs/MASTER_SPEC.md`'s explicit UI requirements. No file was modified in the process. File/line references below reflect the current repository state.

---

## 3. Page-by-Page Audit

### 3.1 Landing Page — `src/LandingPage.tsx` (171 lines)

**What it does:** A single-file marketing page with a phased fade-in animation (headline → subtitle → feature icons → CTA button swap), a 3-feature grid, and a bottom CTA.

**Works:** The animation sequencing (`animationPhase` state machine) is a reasonable, self-contained pattern. The gradient hero background and feature-icon grid are visually coherent with the rest of the app.

**Problems:**
- Entirely fixed desktop-oriented type scale (`text-6xl md:text-7xl` headline) with no mobile-specific tuning beyond the `md:` breakpoint jump — on a small phone this headline wraps awkwardly across 3+ lines.
- "Goal Tracking" is advertised as a feature (twice — in the feature grid and in the icon row) with no corresponding feature anywhere in the app (flagged in the audit as advertised-but-not-implemented).
- No real content below the fold beyond the repeated CTA — for a first-touch marketing page this is thin; no explanation of what the app tracks, no screenshot/preview, no trust signals.
- The animation has no `prefers-reduced-motion` gate.
- Two buttons ("Get Started Free" → "Login to Dashboard") that both do the same thing (both eventually navigate to `/signin`) via a state toggle — a peculiar interaction that doesn't map to any real distinction (there's no separate sign-up CTA on this page at all, despite `/signup` existing as a route).

**Disposition:** **Refactor.** Keep the visual identity (gradient hero, feature grid, phased reveal), fix the mobile type scale, replace the "Goal Tracking" feature with something real (or remove it), add a `prefers-reduced-motion` gate, and add a proper Sign Up CTA alongside Sign In (right now a first-time visitor has no obvious path to registration from the landing page other than clicking through to sign-in and finding the "Register" link there).

### 3.2 Sign In — `src/pages/SignIn.tsx` (20 lines) + `src/components/FieldSet.tsx`'s default export

**What it does:** A centered card wrapping the sign-in form (`FieldSet`'s default export, lines 1–110 of `FieldSet.tsx`).

**Works:** Clean card layout, icon header, consistent with the auth-page visual pattern shared with Sign Up.

**Problems (all in `FieldSet.tsx`, not `SignIn.tsx` itself):**
- No password visibility toggle (spec requirement, absent).
- No "Forgot password?" link (spec requirement, absent — no reset-password flow exists anywhere in the app).
- Personal-looking placeholder email (`jordanvan92@gmail.com`) in the email field — reads as leftover developer data, not a placeholder pattern (should be something like `you@example.com`).
- Error message (`signIn.error?.message`) is the raw Supabase Auth error string, unstyled beyond `text-red-500`.
- No loading skeleton — the whole form renders instantly since there's no server-fetched data, so this is low-priority, but the submit button's `disabled` state during submission has no spinner, just a text swap.

**Disposition:** **Refactor** (the surrounding card/page — keep) + the form itself needs the missing spec-required controls added, which is a component-level rebuild of the form internals using the new `FormField` pattern (Design System §9), not a page-level change.

### 3.3 Sign Up — `src/pages/SignUp.tsx` (22 lines) + `FieldSet.tsx`'s `RegisterField`

**Same pattern and same problems as Sign In**, plus:
- A second personal-looking placeholder email (`picklejn@gmail.com`).
- No password strength/requirements indicator, no confirm-password field.
- No terms-of-service or privacy notice, which the spec's privacy/data-retention requirements (for the eventual AI conversation storage) suggest this app should eventually have somewhere in the sign-up or profile flow.

**Disposition:** **Refactor**, same reasoning as 3.2.

### 3.4 Dashboard — `src/pages/Dashboard.tsx` (201 lines)

**What it does:** A typewriter-animated welcome header, a "Month Net" stat card, and a combined income/expense card with a small donut chart — 2 widgets total.

**Works:** The typewriter effect is a nice, low-cost personalization touch. The two widgets that exist are visually clean.

**Problems:**
- Per the spec, the Dashboard should include: current-period income, current-period expenses, net income, remaining budget, budget utilization, spending by category, recent transactions, budget warnings, a trend chart, period selection, empty states, and an AI assistant entry point. **2 of 12 required elements exist.** This is the single largest gap in the app relative to the spec.
- The grid is declared `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` but only 2 children ever render — on `lg`+ screens there's a visible empty third column.
- The donut chart is fixed-pixel (`width={280} height={140}`), not responsive (Design System §12).
- The "This Month" label is currently incorrect — the underlying totals are all-time, not month-scoped (a data-layer issue tracked in the audit, not a frontend issue, but it means the *design* for a period selector and clear period labeling is now required functionality, not just polish).
- No loading skeleton — a bare `"…"` string substitutes for the numbers while loading.
- `profile.isError` renders a full-page-width red error with no retry and no icon.

**Disposition:** **Rebuild.** The two existing widgets are salvageable as the "Stat card" pattern (Design System §7) inside the new layout, but the page needs to grow from 2 widgets to the full spec'd set — this is closer to new construction than a refactor of what's there. The typewriter welcome header is worth keeping as a distinguishing touch.

### 3.5 Transactions — `src/pages/Transactions.tsx` (13 lines) → `src/components/Card.tsx`'s `Card` → `src/components/TransactionTable.tsx` (426 lines) + `src/components/Navbar.tsx`'s `TransactionNavbar`

**What it does:** The most functionally complete page — full CRUD, search, multi-field filtering (date range, category, type, amount range), sort, pagination, distinct mobile-card/desktop-table rendering.

**Works:** Functionally, this is the strongest page in the app (confirmed in the stabilization audit). The mobile card / desktop table split is exactly the right pattern per the spec ("Mobile-friendly transaction cards / Desktop-friendly tables") — it just needs its visuals unified with the rest of the design system, not rebuilt.

**Problems:**
- **The page's own wrapper component is named `Card`**, and it renders *inside* it a component called `TransactionTable` that renders *inside itself* another component imported from `Navbar.tsx` called `TransactionNavbar`. None of these names describe what they do relative to their file location — this is the clearest case of misleading module organization in the app (detailed in §5).
- Pagination is visually complete (page-number buttons, first/last, prev/next, page-size selector) but is client-side pagination over a server-side-already-paginated slice (a data-layer bug from the audit, not fixable at the component layer alone — the *component* is fine, the *data it's given* is wrong).
- The filter bar (`TransactionNavbar`, ~520 lines living inside `Navbar.tsx`) is comprehensive but dense — on mobile it collapses into a `Sheet`, which is the right call, but the sheet's 2-column filter grid (`grid-cols-2`) makes the date-range picker and category multi-select cramped at small widths.
- Table rows expand inline to reveal Edit/Delete on click (a "select-then-act" pattern) rather than always-visible row actions or a swipe gesture — functional, but non-standard; worth a Stitch comparison against a simpler "action on hover/tap-and-hold" or "always-visible icon buttons" pattern.
- No debounce on the search input (commits on blur/Enter instead — acceptable, but worth confirming against the spec's explicit "Debounce search" requirement, which implies live-as-you-type filtering is expected).

**Disposition:** **Refactor**, not rebuild. Split the three misnamed/co-located components into properly named, properly located files (§5), restyle to the new design system (cards, buttons, inputs already mostly reuse the right primitives), improve the mobile filter sheet layout, and add row-level design polish (§6). The underlying interaction model (search/filter/sort/paginate/expand-to-act) is sound and should not be redesigned from scratch.

### 3.6 Budgets — `src/pages/Budgets.tsx` (94 lines) → `src/components/Card.tsx`'s `BudgetCard` + `src/components/Modal.tsx`'s `BudgetModal`

**What it does:** A responsive card grid of budgets, each with a gauge-style donut showing spent vs. remaining, an Add Budget modal, and per-card Edit/Delete.

**Works:** The grid layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) is genuinely responsive and works well. Loading/error/empty states all exist (unlike Dashboard/Reports) — this page has the right *shape* already, it needs restyling and correctness fixes, not restructuring.

**Problems:**
- The gauge chart is fixed-pixel and non-responsive (same issue as Dashboard).
- Budget status (on-track/close-to-limit/over) is conveyed by gauge color alone (green/yellow/red) with no text/icon — the spec explicitly prohibits this.
- All budgets across all periods render in one flat grid with no period grouping or navigation — the spec requires "Navigate between periods."
- `text-success` is referenced for the "Remaining" figure but the token doesn't exist (renders unstyled) — a straightforward design-system gap (Design System §2.1 adds the missing token).
- Typo: "No bugets yet" in the empty state.
- Add/Edit modal reuses the native-`<dialog>` + `getElementById` pattern flagged in Design System §10.

**Disposition:** **Refactor.** Keep the grid, keep the gauge concept, add the missing status labeling and period navigation, fix the token/typo bugs, migrate the modal to the new Dialog standard.

### 3.7 Reports — `src/pages/Reports.tsx` (10 lines)

**What it does:** Nothing. It's an empty `<div>`.

**Problems:** Per the spec, this page needs income-vs-expense trends, spending by category, net cash flow, budget-vs-actual, highest-spending categories/merchants, average spending, period comparisons, date controls, responsive charts with tooltips/legends, empty states, CSV download, and AI-explanation entry points ("Explain this chart"). **Zero of these exist.** This is the second-largest gap after the Dashboard, and the two are related — Reports is effectively "Dashboard, but historical and detailed," so their chart components should share the same underlying primitives (Design System §12).

**Disposition:** **Build new.** There is nothing to preserve, refactor, or remove — this is new construction against the design system's chart/card/empty-state primitives.

### 3.8 Profile / Settings — `src/pages/Profile.tsx` (420 lines)

**What it does:** A single long form: avatar upload/delete, read-only name/email, disabled currency/number-format selects, a working timezone select, budget-reset-cycle + reset-day fields, save button with a toast-style status message, and account deletion.

**Works:** The section grouping (Personal Information / Regional Preferences / Budget Settings) is a reasonable information architecture and should be kept. The save-status toast pattern (success/error, auto-dismissing) is a good precedent for the app-wide `Toast` component proposed in Design System §15.

**Problems:**
- This page is doing the job of what the spec calls "Profile and Settings" — but there's no actual `/settings` route (commented out in `main.tsx`), so *everything* — including things that are arguably settings, not profile (theme preference, AI conversation settings/history deletion, password reset) — has to live here or nowhere. This is a navigation-architecture decision as much as a page-layout one (see §9).
- Currency and Number Format selects are permanently `disabled` with no explanation shown to the user for *why* — they just don't respond to clicks. Needs the "disabled-but-explained" pattern from Design System §9.
- No password-reset access (spec requirement, absent).
- Sign out is a `<span onClick>` in the Navbar dropdown, not on this page, and (per the stabilization audit) doesn't currently work — both a placement question (should Profile have its own Sign Out button?) and a bug (already logged in `docs/AUDIT_REPORT.md`, not a frontend-only fix).
- Destructive account deletion is a `<span onClick>` styled as a link, using `window.confirm()` — needs the strongest confirmation tier in Design System §10.
- Avatar upload/delete controls are a mix of a real `<label>`-wrapped file input (good, accessible) and a plain `<span onClick>` for delete (not keyboard-reachable).
- No AI conversation settings/history-deletion/privacy-info section yet (expected — the Assistant doesn't exist yet — but the section should be scaffolded now per the task's requirement to include the Assistant in this plan; see §10).

**Disposition:** **Refactor**, restructured around the `FormField`/section-card patterns, with the disabled-field explanation pattern applied, destructive-action confirmation upgraded, and a placeholder "AI & Privacy" section scaffolded for when the Assistant ships. This does **not** need to become two pages (Profile vs. Settings) — see §9 for the navigation-level recommendation to keep this as one screen with clear sub-sections rather than splitting it, given the spec lists "Profile and Settings" as one combined requirement and the page's own content is already naturally grouped into three sections that could become four or five.

### 3.9 App Shell — `src/AppLayout.tsx` (17 lines) + `src/components/Navbar.tsx` (734 lines)

**What it does:** `AppLayout` renders `Navbar` + `<Outlet />`. `Navbar.tsx` contains **two unrelated components**: the actual app navigation bar (`Navbar`, ~150 lines) and the entire transaction-filtering toolbar (`TransactionNavbar`, ~520 lines) — co-located only because they were both originally "navbar-shaped" UI, not because they're related.

**Works:** The desktop nav's active-route highlighting and the mobile `Sheet` menu are both solid, accessible-enough foundations.

**Problems:**
- Nav items are hardcoded as **parallel arrays** (`NavNames`, `NavTo`, `DNames`, `DTo`) passed as props from `AppLayout` — adding, removing, or reordering a nav item means editing four arrays in lock-step with no compile-time guarantee they stay aligned. This is the exact pattern that needs to change to add an "Assistant" entry cleanly (§9).
- The logo is a hardcoded placeholder string, `"JV DUMPY"`. The approved product name is **Nexali**; the logo text and page title should be replaced with it during implementation (see `docs/design-reference/README.md`'s Brand section).
- The desktop account dropdown opens on **hover only** (`group-hover:visible`) — not reachable by keyboard at all (accessibility failure, Design System §18).
- "Settings" in the dropdown links to `/dashboard` (dead link — the route doesn't exist) and "Sign Out" links to `/` without calling `supabase.auth.signOut()` (both already logged as bugs in the stabilization audit, but they're also *navigation design* problems: the dropdown currently advertises two destinations that don't do what they say).
- `TransactionNavbar`'s presence inside `Navbar.tsx` means the file that should define "what does the app's navigation look like" is 70% consumed by an unrelated feature's filter UI.

**Disposition:** **Refactor and split.** `Navbar.tsx` becomes two files: `AppNav.tsx` (the real navigation, driven by a single typed route-config array instead of four parallel arrays) and `TransactionFilterBar.tsx` (moved to sit next to `TransactionTable.tsx`, where it's actually used). This split is a prerequisite for adding the Assistant nav entry and the mobile bottom-nav (§9) cleanly.

---

## 4. Component Inventory — Preserve / Refactor / Replace / Remove

| Component | File | Disposition | Why |
|---|---|---|---|
| `Button` + variants | `ui/button.tsx`, `ui/button-variants.ts` | **Preserve** | Solid, accessible, already-centralized variant system (Design System §8) |
| `Badge` + variants | `ui/badge.tsx`, `ui/badge-variants.ts` | **Preserve** | Same reasoning |
| `Input` | `ui/input.tsx` | **Preserve** | Standard, no issues found |
| `Label` | `ui/label.tsx` | **Preserve** | Standard, no issues found |
| `Select` | `ui/select.tsx` | **Preserve** | Radix-based, accessible |
| `Popover` | `ui/popover.tsx` | **Preserve** | Used correctly for date range / amount filters |
| `DropdownMenu` | `ui/dropdownMenu.tsx` | **Preserve** | Used correctly for category/type/sort filters |
| `Sheet` | `ui/sheet.tsx` | **Preserve** | The right pattern for mobile nav and filter panels; extend usage, don't replace |
| `Table` | `ui/table.tsx` | **Preserve** | Already wraps content in `overflow-auto`, correctly prevents page-level horizontal scroll |
| `Card` (shadcn primitive) | `ui/card.tsx` | **Preserve, adopt** | Exists but is **currently unused** — every hand-rolled card in the app should migrate to it (see below) |
| `Calendar` | `ui/calendar.tsx` | **Refactor** | Functional hand-rolled implementation (replaced `react-day-picker` during stabilization); works, but only supports month-at-a-time navigation with no keyboard arrow-key navigation between days — worth a light accessibility pass, not a rewrite |
| `Navbar` (nav portion) | `components/Navbar.tsx` | **Refactor → split into `AppNav.tsx`** | See §3.9 |
| `TransactionNavbar` | `components/Navbar.tsx` | **Refactor → move to `TransactionFilterBar.tsx`** | See §3.9, §5 |
| `Card` (page wrapper) | `components/Card.tsx` | **Refactor → rename/split** | The default export just wraps `TransactionTable` for no clear reason — inline it into `Transactions.tsx` or rename to `TransactionsPanel` |
| `BudgetCard` | `components/Card.tsx` | **Refactor → move to `BudgetCard.tsx`** | Good component, wrong file, needs the design-system card/chart/status treatment |
| `Modal` (transaction) | `components/Modal.tsx` | **Replace** | Migrate off native-`<dialog>` + `getElementById` onto the new `Dialog` standard (Design System §10) |
| `BudgetModal` | `components/Modal.tsx` | **Replace** | Same reasoning |
| `FieldSet` (sign-in form) | `components/FieldSet.tsx` | **Refactor → split into `SignInForm.tsx`** | Needs password visibility + forgot-password; wrong file (co-located with 3 unrelated forms) |
| `RegisterField` | `components/FieldSet.tsx` | **Refactor → split into `SignUpForm.tsx`** | Same reasoning |
| `AddField` (transaction form) | `components/FieldSet.tsx` | **Refactor → split into `TransactionForm.tsx`** | Solid validation logic, needs the `FormField` pattern and its own file |
| `AddBudget` (budget form) | `components/FieldSet.tsx` | **Refactor → split into `BudgetForm.tsx`** | Same reasoning |
| `TransactionTable` | `components/TransactionTable.tsx` | **Refactor** | Extract `MobileTransactionCard` and `PaginationControls` (currently redefined every render — a real perf issue, not just a style one) to module scope or their own files; restyle to design system |
| `CategoryPicker` | `components/CategoryPicker.tsx` | **Preserve, restyle** | Good combobox-with-create UX; just needs `text-white` hardcoding replaced with theme tokens |
| `CategoryFilterDropdown` | `components/CategoryFilterDropdown.tsx` | **Preserve, restyle** | Functionally fine, small |
| Dashboard's `MonthNetWidget` | `pages/Dashboard.tsx` | **Refactor → generalize into `StatCard`** | The concept (icon, big number, trend arrow) is exactly right and should become the reusable Design System §7 "Stat card," not stay Dashboard-specific |
| Dashboard's `MonthIncomeExpenseWidget` | `pages/Dashboard.tsx` | **Refactor → split into `StatCard` + `ChartCard`** | Currently couples two stats and a chart into one component; the design system separates these concerns |
| `Reports` page | `pages/Reports.tsx` | **Build new** | Nothing exists to preserve |
| `Assistant` page/panel | *(does not exist)* | **Build new** | See §10 |
| `useIsMobile` | `hooks/useMobile.tsx` | **Refactor usage, keep hook** | The hook itself is fine (a `matchMedia` listener); the *pattern* of branching entire component trees on it (`isMobile ? <A/> : <B/>`) is what needs to go away in favor of CSS breakpoints wherever the two branches are just different Tailwind classes on the same content. Keep it only for cases where the DOM structure must genuinely differ (e.g., bottom-nav vs. top-nav), not for styling differences. |
| `WithErrorBoundary` | `ErrorBoundary.tsx` | **Preserve, extend usage** | Currently wraps only `/dashboard`; extend to every route once the new `ErrorState` component (Design System §15) exists as its fallback UI, so a crashed page shows the app's error design instead of raw `<pre>{error.message}</pre>` |

---

## 5. Duplicated UI Patterns and Oversized Components

**Duplicated patterns (all consolidate into the Design System components in §6–15 of `docs/DESIGN_SYSTEM.md`):**

1. **Card surface** hand-rolled independently in `Card.tsx` (twice — the wrapper and `BudgetCard`), `Modal.tsx` (twice), and inline in `Dashboard.tsx`'s two widgets — six independent `<div className="bg-gradient-card border ...">` declarations that should be one `Card` component instance each.
2. **Donut/pie chart** implemented three times (`Dashboard.tsx` ×1, `Card.tsx`'s `BudgetCard` ×1, structurally identical `PieChart`/`Pie`/`Cell`/`Tooltip` blocks) with separately-defined `contentStyle`, separately-computed color arrays, and no shared sizing logic.
3. **Loading text** (`"Loading…"`, `"Loading Budgets..."`, `"Loading profile…"`, `"Loading transactions…"`) independently written in `Dashboard.tsx`, `Budgets.tsx`, `Profile.tsx`, `TransactionTable.tsx` — four strings, four slightly different implementations, zero shared skeleton component.
4. **Error rendering** (`{error?.message ?? "fallback"}` in a red `<div>`) independently implemented in `Dashboard.tsx`, `Budgets.tsx`, `Profile.tsx`, `TransactionTable.tsx`, `FieldSet.tsx` (×2) — six near-identical blocks.
5. **`pathFromPublicUrl`** — a URL-parsing helper duplicated three times: `lib/storage.ts`, `features/profiles/useAvatar.ts`, and inline inside the `delete-user` Edge Function (already flagged in the stabilization audit; relevant here because a frontend refactor pass is a natural place to at least consolidate the two client-side copies into one shared import, even though the Edge Function copy is out of this task's scope).
6. **Confirm-then-delete via `window.confirm()`/`alert()`** — three independent call sites (`Profile.tsx` account deletion, `Budgets.tsx` budget deletion, `TransactionTable.tsx` transaction deletion), each a plain browser-native dialog with no design, no keyboard/screen-reader consistency guarantee across browsers.
7. **Mobile/desktop branching via `isMobile ? A : B`** — `Navbar.tsx` (nav render), `Navbar.tsx`'s `TransactionNavbar` (search+filter layout), `TransactionTable.tsx` (card vs. table) — three places independently re-deciding what "mobile" means and re-implementing two full render branches, rather than one component whose Tailwind classes respond to breakpoints.

**Oversized components (line counts as of this audit):**

| File | Lines | Why it's oversized |
|---|---|---|
| `Navbar.tsx` | 734 | Two unrelated components (§3.9) |
| `FieldSet.tsx` | 656 | Four unrelated forms (sign-in, sign-up, transaction, budget) sharing nothing but a file |
| `TransactionTable.tsx` | 426 | One page's worth of table, mobile-card rendering, pagination, and two components (`MobileTransactionCard`, `PaginationControls`) redefined inline on every render |
| `Profile.tsx` | 420 | Not unreasonable for a single settings form, but will grow further once AI/privacy settings are added — worth splitting into section sub-components now so it doesn't become unmanageable later |

No component in the app is currently *so* large that it's unreadable, but `Navbar.tsx` and `FieldSet.tsx` in particular mix concerns badly enough that splitting them is a prerequisite for cleanly making the other changes this plan proposes (you cannot cleanly add a password-visibility toggle to "the sign-in form" when "the sign-in form" is one of four things a 656-line file exports).

---

## 6. Cross-Cutting Problems

### 6.1 Mobile

- Layout branching is JS-based (`useIsMobile()`, evaluates `false` on first render before the media query listener fires) rather than CSS-based, causing a one-frame flash of desktop layout on mobile load, and duplicating render logic (§5, item 7).
- No `viewport-fit=cover` in `index.html`'s meta viewport tag, and no `env(safe-area-inset-*)` padding anywhere — content will sit under the iPhone notch/home-indicator and Android gesture bar once this ships as a PWA/Capacitor app, which the spec explicitly requires supporting.
- Several tap targets are below the 44×44px minimum (pagination arrows at `h-8 w-8`, badge-embedded `X` filter-remove icons).
- Filter sheet's `grid-cols-2` layout (`Navbar.tsx`'s `TransactionNavbar`) is cramped for the date-range picker and category dropdown on a 375px-wide screen.
- No bottom navigation — all navigation on mobile currently requires opening the hamburger `Sheet`, which is an extra tap for the primary destinations (Dashboard/Transactions/Budgets) that should be one tap away (§9).

### 6.2 Tablet

- **No tablet-specific layout exists anywhere.** Every page either uses the mobile branch or the desktop branch of its `isMobile` check, or a single fixed grid that happens to look acceptable at `md`/`lg` — there is no deliberate "this is what an iPad sees" design decision anywhere in the codebase today.
- The spec explicitly calls for either a full page, a split-view panel, or a collapsible side panel for the Assistant on tablets — none of these three patterns exist yet for *any* page, so there's no precedent to extend.
- Portrait vs. landscape on iPad is not distinguished anywhere (both currently just fall into whichever of the mobile/desktop branches the width happens to trigger).

### 6.3 Desktop

- Generally the strongest-supported breakpoint (most components were visibly designed desktop-first, then had mobile bolted on) — the main desktop problems are the empty grid slot on Dashboard (§3.4), the fixed-pixel charts, and the hover-only account dropdown (§3.9).
- No page uses more than a `max-w-7xl`-equivalent constrained width with centered content on very large desktop monitors in a deliberate way — worth confirming intended max content width in Stitch rather than letting grids stretch indefinitely.

### 6.4 Accessibility

Consolidated from the page-by-page audit (full detail in `docs/AUDIT_REPORT.md` §7, restated here as design requirements):
- Non-keyboard-reachable destructive actions (`<span onClick>` for delete-avatar, delete-account, delete-budget/transaction row actions in some paths).
- Icon-only buttons without `aria-label` (mobile menu trigger, pagination arrows, avatar dropdown trigger).
- Hover-only desktop account dropdown, unreachable by keyboard.
- No `aria-labelledby`/focus management on native `<dialog>` modals.
- No `prefers-reduced-motion` handling anywhere motion is used.
- Budget/financial status conveyed by color alone.
- Heading hierarchy skips (Dashboard's welcome text is a `<div>`, not `<h1>`).
- Mismatched `<Label htmlFor>` / input `id` pairs (Profile's Full Name field).
- Hardcoded `text-white` bypassing theme contrast tokens.

Every item above is addressed structurally by adopting the Design System's component contracts (§8–18 there) rather than needing a separate accessibility-only pass — accessibility here is a *property of using the shared components correctly*, not a bolt-on checklist.

### 6.5 Navigation

- Parallel-array nav configuration (§3.9) — fragile, error-prone, blocks clean addition of new destinations.
- Two dead links (Settings → `/dashboard`, Sign Out → `/` without actually signing out).
- No indication anywhere in the nav of *where the Assistant will live* — full navigation proposal in §9–10.
- No breadcrumb/back-affordance need identified — the app's hierarchy is flat, so this isn't a gap, just confirming it's not needed.

### 6.6 Charts

Consolidated in Design System §12 — summary: three ad hoc, non-responsive, fixed-pixel pie charts with duplicated tooltip styling, inline color literals, no accessible text summary, no legend, and (for Reports) an entire missing chart *type* inventory (trend line, category bar ranking, budget-vs-actual) that doesn't exist yet anywhere in the app to even serve as a bad example.

### 6.7 Forms

- Four structurally different forms in one file with no shared field/error/label composition (§5).
- Missing spec-required controls: password visibility, forgot/reset password, terms/privacy notice on sign-up.
- Disabled fields (Currency, Number Format) give no feedback on *why* they're disabled.
- Form-level (not field-level) error display in `AddBudget`, disconnecting the error message from the specific invalid field.
- No duplicate-submission guard visible beyond `disabled={isPending}` on the submit button (adequate, but worth confirming it also blocks Enter-key resubmission during a pending request — not verified as broken, just not explicitly tested).

### 6.8 Layout

- Five different border-radius values with no rule (Design System §5).
- No consistent spacing scale — values chosen per component (Design System §4).
- Inconsistent page title sizing across pages (Design System §3).
- `--success` token referenced but undefined (renders unstyled text).
- Dead `.dark` CSS block that would regress the brand palette if ever activated.

---

## 7. Proposed Visual Direction

Full specification in `docs/DESIGN_SYSTEM.md`. Summary: **evolve, don't replace.** The app already has a distinctive identity — dark background, green/blue gradient accents, rounded gradient cards, glow-on-hover — that reads as "modern financial dashboard" and is worth keeping rather than discarding for a generic redesign. The revamp's visual work is:

1. **Formalize the token system** — add the two missing semantic colors (`--success`, `--warning`), retire the dead `.dark` block, replace every inline color/spacing/radius literal with a token or scale value.
2. **Unify the card system** — one `Card` component, one radius tier for primary cards, applied consistently instead of six independent hand-rolled surfaces.
3. **Build the missing state vocabulary** — skeletons, empty states, and error states don't meaningfully exist today (a string of text is not a designed state) and are needed on every page, not just new ones.
4. **Extend the pattern that already works** (mobile card / desktop table on Transactions, the section-grouped form on Profile, the responsive card grid on Budgets) to the pages that don't have it yet (Dashboard, Reports), instead of inventing new patterns per page.
5. **Add the two structural pieces the spec requires that don't exist in any form today**: a real chart-primitive set (§6, Design System §12) and a mobile bottom-navigation (§9).

---

## 8. Responsive Behavior Proposal

Reference breakpoints: Design System §19 (Tailwind defaults, `sm`/`md`/`lg`/`xl`/`2xl`).

| Device class | Representative width | Layout behavior |
|---|---|---|
| **iPhone (small–standard)** e.g. SE, 13/14/15 | 375–393px | Single-column everywhere. Bottom tab bar (§9) with safe-area padding. Cards full-width with `px-4` page padding. Charts full-width inside their card, `ResponsiveContainer` height ~180–220px. Forms and modals render full-screen (Design System §10). Table pages show the mobile-card list, never the `<table>`. |
| **Android phone** (varies; treat as the `base`–`sm` range, same as iPhone) | 360–412px | Same as above — no Android-specific layout differences are needed; differences are OS-level (back-gesture handling, covered under Capacitor prep, not this plan) rather than CSS-level. |
| **iPad portrait** | 768–834px (`md`) | Two-column card grids where content supports it (Budgets, Dashboard stat cards). Forms/modals: centered dialog, **not** full-screen (Design System §10) — enough width exists. Navigation: top nav bar (not bottom tabs) once ≥`md`, but confirm this cutover point against real device testing — an iPad Mini portrait is narrower than a large Android phone landscape, so the breakpoint choice needs validation, not just a `md:` default (see §12, item 5). Table pages may show the desktop `<table>` if it fits without horizontal scroll, otherwise the mobile-card list — needs a per-page width check, not an assumption. |
| **iPad landscape** | 1024–1194px (`lg`) | Full desktop-equivalent layout: 3–4 column grids, desktop `<table>`s, top nav. This is effectively "small laptop" territory and should reuse the laptop/desktop layout wholesale rather than a bespoke tablet-landscape design. |
| **Laptop** | 1280–1440px (`xl`) | Standard desktop layout — 3–4 column grids, full nav, charts at comfortable fixed-aspect widths within their cards. |
| **Large desktop** | 1536px+ (`2xl`) | Content max-width constrained (proposed `max-w-7xl`, confirm in Stitch) and centered — grids should not keep adding columns indefinitely; extra width becomes margin, not more content density. |

**Orientation handling (explicit gap today, addressed here):** iPad portrait→landscape rotation should be a pure CSS breakpoint response (crossing from `md` to `lg` territory) — no orientation-specific JS logic needed if the `md`/`lg` breakpoints are chosen to align with real iPad portrait/landscape widths, which is why item 5 in §12 flags this as needing device-dimension validation rather than assuming Tailwind's defaults line up perfectly.

---

## 9. Navigation Structure Proposal

### 9.1 Desktop / laptop (`lg`+)

Top nav bar (kept from today, restyled): logo · Dashboard · Transactions · Budgets · Reports · **Assistant** · account menu (avatar → Profile, Sign Out — Settings folded into Profile per §3.8, not a separate item). Account menu becomes click-to-open (not hover-only), keyboard operable, per Design System §18.

### 9.2 Tablet (`md` / `lg` depending on the §12 validation)

Same as desktop nav bar at `lg`+. Between `md` and `lg`, propose the desktop top nav *compressed* (icon + label becomes icon-only with tooltip, or a horizontally-scrollable nav strip) rather than switching to the mobile bottom-nav — an iPad portrait screen is wide enough for a top bar, just not wide enough for the full label set. Exact treatment is a Stitch decision (§11, screen list includes an iPad-portrait nav state).

### 9.3 Mobile (`base`–`sm`)

**New: fixed bottom tab bar**, 4–5 destinations. Proposed set (needs approval, §12 item 5):

`Dashboard · Transactions · Budgets · Assistant · More`

— where **More** opens the existing `Sheet` pattern containing Reports, Profile, and Sign Out (items that don't need one-tap access as often as the primary four). This keeps the bottom bar from being crowded (5 items is close to the practical maximum for thumb-reachable tab bars) while still surfacing the Assistant as a primary, one-tap destination per the spec's requirement that it appear in the mobile navigation, not just buried in a menu.

Bottom bar respects `env(safe-area-inset-bottom)`. Active tab uses the same filled-pill/active-color treatment as the current desktop nav, adapted to a tab-bar icon+label layout.

### 9.4 Cross-cutting

- The parallel-array nav config (`NavNames`/`NavTo`/`DNames`/`DTo`) is replaced by one typed route-config list (e.g., `{ label, path, icon, section: 'primary' | 'secondary' }[]`) that both the desktop top nav, the tablet compressed nav, and the mobile bottom-nav + "More" sheet all read from — one source of truth instead of four arrays plus a second hardcoded set for the account dropdown.
- Settings/Sign Out dead links get fixed as part of this restructure (Sign Out actually calls `supabase.auth.signOut()`; "Settings" either becomes "Profile" in the label or the nav item is removed entirely since Profile already contains what Settings would).

---

## 10. The AI Assistant in the Design Plan

The Assistant is not being built in this task, but the spec requires its navigation placement, Dashboard entry point, and page shell to be planned now so the nav/layout work in this revamp doesn't need to be redone when it ships.

**Naming:** the assistant's approved name is **Aura**. "Assistant" below refers to the feature category; user-facing copy (nav label, page heading, starter-question prompts, entry-point card) should say Aura, for example "Aura" or "Ask Aura," not a generic placeholder. This matches the design references in `docs/design-reference/assistant/`, which already show "Aura" as the assistant's name within the Nexali app.

- **Desktop/tablet:** "Assistant" is a full top-nav item (§9.1), routing to a dedicated `/assistant` page — a full conversational interface (message list, starter-question chips, input bar) using the same `Card`/`Dialog`/`Sheet` primitives as the rest of the app, not a bespoke chat-widget library.
- **Mobile:** "Assistant" is a primary bottom-tab item (§9.3), opening full-screen (no narrow chat window) per the spec's explicit requirement.
- **Tablet:** Support either a full `/assistant` page or a collapsible side panel — propose the **side panel** as the default for `lg`+ tablet-landscape (screen real estate supports it, and it lets a user reference the Assistant's answer against the underlying Dashboard/Reports data simultaneously, which is exactly the kind of cross-reference the spec's "links to related transactions/budgets/reports" requirement implies), with the full-page route as the fallback at narrower tablet-portrait widths. This is a Stitch-stage decision, not a default to build blind (§11, §12).
- **Dashboard entry point:** a small "Ask the Assistant" card/panel (Design System §7's "Content card" variant) with 2–3 starter-question chips, linking to the full `/assistant` page — per the spec's "smaller optional assistant panel may also appear on the Dashboard, but it must link to the complete Assistant experience."
- **Reports entry points:** once Reports is built (§13, sequenced before the Assistant), each major chart gets a small "Explain this chart" / "Ask the Assistant" action (an icon button in the chart card's header, per the shared `ChartCard` component in Design System §12) that will, once the Assistant exists, open it pre-loaded with that chart's context. Building this affordance into `ChartCard` now (even as a visible-but-disabled or "Coming soon" action) means Reports doesn't need a second pass later just to add it.
- **Empty/loading/error states:** the Assistant reuses the shared `EmptyState`, `SkeletonText`/a chat-specific typing-indicator skeleton, and `ErrorState` components (Design System §13–15) — plus the spec-required distinct "Assistant unavailable, but the rest of the app still works" error variant noted in Design System §15.
- **What this plan does NOT decide:** any AI provider, model, prompt, tool schema, or backend architecture — that's `docs/MASTER_SPEC.md`'s "AI Assistant" sections and a future implementation task, explicitly out of scope here per this task's instructions.

---

## 11. Screens to Design in Google Stitch

Per `docs/MASTER_SPEC.md`'s workflow ("Use Stitch for: Design exploration, Mobile layouts, Tablet layouts, Desktop layouts, Assistant page design, ... Financial summary cards, ... Empty states, Loading states, Error states"). Proposed screen list, grouped by what a single Stitch pass should cover together:

**Core layouts (establish the system):**
1. Desktop Dashboard — full spec'd layout (all 12 elements from §3.4), including the Assistant entry-point card.
2. Mobile Dashboard — same content, single-column, bottom tab bar visible.
3. iPad-portrait Dashboard — validates the `md` two-column decision (§8).
4. Desktop nav bar (idle + active-route states) and mobile bottom-tab bar (idle + active state) — same pass, since they need to visually agree.

**Transactions (refactor of an existing strong page — confirm restyle, not redesign):**
5. Desktop Transactions — table + filter bar, restyled to the new design system.
6. Mobile Transactions — card list + filter sheet, restyled.
7. Add/Edit Transaction dialog — desktop (centered) and mobile (full-screen) states in one pass.

**Budgets:**
8. Desktop Budgets — card grid with the new status-labeled gauge (color + text/icon, per Design System §1 rule 3).
9. Mobile Budgets — single-column card list.
10. Add/Edit Budget dialog.

**Reports (new construction):**
11. Desktop Reports — full layout: trend chart, category breakdown, budget-vs-actual, top categories/merchants, date controls, CSV export action, "Explain this chart" affordance.
12. Mobile Reports — same content, stacked, charts full-width.
13. Reports empty state (no data for selected period) and loading skeleton state.

**Profile / Settings:**
14. Desktop Profile — restructured sections including the new "AI & Privacy" placeholder section.
15. Mobile Profile.
16. Account-deletion confirmation flow (the strong-confirmation dialog, Design System §10).

**Assistant (design the shell now, not the AI behavior):**
17. Desktop Assistant — full conversational page: message list, starter questions, input bar, financial summary cards inline in responses.
18. Mobile Assistant — full-screen conversational view.
19. Tablet Assistant — both candidate layouts (full page vs. side panel, §10) so the choice between them can be made visually rather than argued abstractly.
20. Dashboard's "Ask the Assistant" entry-point card (mobile + desktop).

**Shared component states (design once, reused everywhere — do this pass early since everything above depends on it):**
21. Card system — stat card, content card, entity card, form card (Design System §7), each in default/hover/loading/error state.
22. Empty states — the generic `EmptyState` component with 2–3 example fills (no transactions, no budgets, filtered-to-nothing).
23. Error states — the generic `ErrorState` component with retry action.
24. Loading skeletons — skeleton text, skeleton card, skeleton chart, skeleton row, matched against their real counterparts.
25. Confirmation dialog — standard tier (delete budget/transaction) and strong tier (delete account).

**Auth:**
26. Sign In / Sign Up — restyled, including password-visibility toggle and forgot-password link.

**Recommended order to send to Stitch:** #21–25 (shared components) first — everything else is faster to design once the card/empty/error/loading vocabulary is fixed — then #1–4 (Dashboard + nav, since it's the highest-traffic page and validates the token/spacing decisions at scale), then the remaining pages roughly in the implementation order proposed in §13.

---

## 12. Visual Decisions Requiring Approval

These cannot be finalized from the codebase audit alone — they're either genuine taste calls, values that need to be seen before being judged, or dependent on Stitch output:

1. **`--success` and `--warning` token exact values** (Design System §2.1) — proposed HSL values need a visual side-by-side check against the existing `--primary` green so "success" and "primary action" don't collide.
2. **Categorical chart palette** for categories/merchants (Design System §2.3) — needs an approved 8–10 color set, tested for distinguishability on the dark background and (ideally) for colorblind-safety, since category charts are a core, frequently-viewed feature.
3. **Whether a light theme is in scope at all** — the current `.dark` CSS block is dead and, if activated as written, would regress the brand palette. Decide now whether "dark app, no light mode" is the permanent direction (simplest — just delete the dead block) or whether a designed light theme should be scoped as a later phase (in which case the dead block should be replaced with a real light palette, not just deleted).
4. **Landing page display typography** — system font (consistent with the rest of the app) vs. a loaded display font for the marketing headline only (Design System §3.2).
5. **Tablet breakpoint validation** — whether Tailwind's default `md`(768px)/`lg`(1024px) cutovers actually match where you want iPad-portrait vs. iPad-landscape behavior to switch, given real iPad Mini/Air/Pro portrait widths (744–834px) span across that boundary depending on model (§8).
6. **Mobile bottom-nav item set** — the proposed `Dashboard / Transactions / Budgets / Assistant / More` five-item set (§9.3) vs. alternatives (e.g., swapping Budgets for Reports as a primary tab, or a 4-item bar with Profile folded into "More" alongside Reports).
7. **Assistant tablet layout** — full page vs. collapsible side panel as the default for `lg` tablet-landscape (§10) — genuinely a UX taste call best resolved by seeing both in Stitch (screen #19).
8. **Landing page content beyond the fold** — whether to keep it minimal (current 3-feature-grid + CTA structure, cleaned up) or expand it with a product screenshot/preview, given this is a personal-use-leaning app rather than a marketing-funnel product; affects how much new landing-page content needs designing vs. just restyling.
9. **Max content width on large desktop** (§8, "Large desktop" row) — confirm `max-w-7xl` or another value once real chart/card content is laid out at that width in Stitch.
10. **"Goal Tracking" landing-page feature** (§3.1) — remove it, or treat it as a signal that goal-tracking should actually be added to the product roadmap (a product-scope decision, not a visual one, but it blocks finalizing the landing page's feature-grid content).

---

## 13. Page-by-Page Implementation Order

Sequenced so each phase is independently shippable/revertible, foundational work happens before the pages that depend on it, and the highest-value spec gaps (Dashboard, Reports) aren't attempted before the design system they'd be built on exists. Assumes Stitch screens (§11) and approvals (§12) are resolved before phase 1 starts.

1. **Design system foundation** — add `--success`/`--warning` tokens, remove the dead `.dark` block (or replace it, per §12 item 3), fix the five-radius inconsistency, build the shared components with no page depending on them yet: `Card` (adopt the existing primitive), `SkeletonText`/`SkeletonCard`/`SkeletonChart`/`SkeletonRow`, `EmptyState`, `ErrorState`, `Toast`/`useToast`, `ConfirmDialog` (standard + strong tier), `FormField`. Nothing user-facing changes yet — this is pure infrastructure, verified via the Storybook-style manual checks or component tests noted in §15.
2. **App shell & navigation** — split `Navbar.tsx` into `AppNav.tsx` + `TransactionFilterBar.tsx`; replace the parallel-array nav config with one typed route list; fix the hover-only account dropdown; add the mobile bottom tab bar; fix the Sign Out / Settings dead links (coordinating with the already-logged backend bug fix for `signOut()`). This phase touches every page indirectly (nav wraps everything) so it goes early, right after the components it depends on exist.
3. **Auth pages** (Sign In / Sign Up) — smallest page surface, good validation of the new `FormField`/`Card` patterns before applying them to bigger pages; add password visibility + forgot-password link (forgot-password *UI* only, since the backend reset flow is a separate, non-frontend task) here.
4. **Transactions** — highest existing functional value, mostly a restyle: migrate `Card.tsx`/`TransactionTable.tsx`/the new `TransactionFilterBar.tsx` onto the new `Card`/`Dialog`/skeleton/empty/error components; extract `MobileTransactionCard`/`PaginationControls` to real modules; fix the mobile filter-sheet grid layout.
5. **Budgets** — similar restyle scope to Transactions; add status text/icon alongside gauge color; migrate `BudgetModal` to the new `Dialog`; add period navigation UI (coordinating with the backend period-scoping fix already logged in the audit).
6. **Dashboard** — now that `StatCard`/`ChartCard`/nav/Assistant-entry-point patterns all exist from prior phases, build out the remaining ~10 of 12 spec'd elements (remaining budget, budget utilization, spending-by-category, recent transactions, budget warnings, trend chart, period selection, empty states, Assistant entry card).
7. **Reports** — the largest net-new page; reuses every chart/card/empty/error component built by now, so it should be comparatively fast despite being new construction. Includes the CSV export action and the "Explain this chart" affordance (disabled/"coming soon" until the Assistant ships).
8. **Profile / Settings** — restructure into the section-card pattern, add the disabled-field explanation treatment, upgrade destructive-action confirmations to the strong tier, scaffold the "AI & Privacy" placeholder section.
9. **Landing page** — deliberately last: it's the page least connected to the rest of the app's component reuse, lowest functional risk, and benefits from every other page's visual language being finalized first so it can accurately represent the product it's advertising.
10. **Assistant shell** (page scaffold + nav entry + Dashboard/Reports entry points, no AI behavior) — build the *empty* conversational UI (message list container, starter-question chips, input bar, all three states from Design System §15) wired to nothing, so the nav/layout/entry-point work is complete and the follow-up task that adds the actual AI Edge Function + tools only needs to wire up data, not build UI. This intentionally stops short of any backend work per this task's constraints.

---

## 14. Lazy-Loading and Bundle-Size Opportunities

Current baseline (`docs/AUDIT_REPORT.md` §5, post-stabilization): a single ~891 kB JS chunk, no route splitting.

- **Route-level code splitting**, via `React.lazy()`/`Suspense` per route in `main.tsx`, is the single biggest win and costs little: `Dashboard`, `Transactions`, `Budgets`, `Reports`, `Profile`, and (once built) `Assistant` all become separate chunks loaded on navigation instead of all up front. `LandingPage`/`SignIn`/`SignUp` should also split from the authenticated bundle, since an unauthenticated visitor never needs Transactions/Budgets/Reports/Profile code at all.
- **Recharts** is a meaningful share of the bundle and is only used on Dashboard/Budgets/Reports — splitting those routes automatically defers Recharts' load until a chart-bearing page is actually visited.
- **Radix UI primitives** (`Popover`, `DropdownMenu`, `Sheet`, `Select`) are used across enough pages that they don't need per-route splitting, but the future `Dialog` addition (Design System §10) should be checked for whether it pulls in `@radix-ui/react-dialog` bundle weight beyond what `Sheet` (already on `@radix-ui/react-dialog`) already includes — likely negligible since it's the same underlying package, but worth confirming after implementation with a bundle-analyzer pass.
- **The `blank_profile_pic.jpg` placeholder** ships at 219 kB unoptimized and loads on every authenticated page via the Navbar avatar — converting it to a compressed WebP/AVIF (or a lightweight inline SVG placeholder instead of a photo) removes a fixed 219 kB cost from the initial authenticated-shell load, independent of route splitting.
- **`date-fns`** is imported broadly (`import { format } from "date-fns"`) rather than from specific submodules — confirm the build's tree-shaking is actually eliminating unused locales/functions once bundle analysis is run post-implementation; if not, switching to `date-fns/format`-style deep imports is a cheap follow-up.
- **A bundle analyzer** (`rollup-plugin-visualizer` or `vite-bundle-visualizer`) should be added as a dev-only tool at the start of implementation (phase 1, alongside the design-system foundation work) so every subsequent phase can be checked against a real bundle-size baseline rather than guessed at — this is tooling, not a design decision, and is cheap to add now.

None of the above requires a design decision — it's confirmed as implementation-phase work, sequenced to happen naturally as routes get rebuilt in §13 rather than as a separate pass.

---

## 15. Where Automated Tests Should Be Added During Implementation

**Update — this section's prerequisite is now satisfied.** Vitest, React Testing Library, `@testing-library/jest-dom`, `@testing-library/user-event`, and jsdom are installed and configured (`vite.config.ts`'s `test` block, `src/test/setup.ts`), with `npm run test` / `test:watch` / `test:coverage` scripts and 14 passing tests already in place, covering the shared `Button`, `Input`+`Label`, a new `formatCurrency` utility, and `AuthGate`'s loading/redirect/success behavior. Full detail in `docs/AUDIT_REPORT.md` §15–16. Everything below can now be written as each corresponding piece of §13's implementation order is built — no further tooling setup is needed first.

The original text of this section (below) is left intact as the rationale for *why* tests are sequenced where they are; only the "no runner exists yet" framing has changed.

**Component tests (unit-level, added alongside each shared component in §13 phase 1):**
- `Card` variants render children/className correctly.
- `EmptyState`/`ErrorState` render the passed headline/action and call the retry/action callback on click.
- `ConfirmDialog` — standard tier confirms on single click; strong tier requires the typed-confirmation text to match before enabling Confirm.
- `FormField` — associates label/input/error via the correct `aria-*` attributes (a regression test for the exact `htmlFor`/`id` mismatch bug found in Profile during the audit).
- Skeleton components render without crashing and respect a `reducedMotion` prop/media-query mock.

**Interaction tests (added alongside each page in its §13 phase):**
- **Auth pages:** password-visibility toggle actually toggles input `type`; form validation blocks submit on empty/invalid fields; error message renders on a mocked failed sign-in.
- **Transactions:** filter changes update the query params/filters object correctly (already partially covered by existing logic, currently untested); Add/Edit dialog opens with correct pre-filled values in edit mode vs. empty in add mode; delete flow requires confirmation before calling the delete mutation (mock the mutation, assert it's *not* called until confirm).
- **Budgets:** duplicate-budget prevention (once the backend constraint lands) surfaces a field-level error, not a silent failure; gauge status text matches the color tier at the 75%/95% thresholds (a direct regression test for the color-alone accessibility fix).
- **Dashboard:** period selector changes the displayed figures' labels (once period-scoping lands); empty state renders when a new user has no transactions.
- **Reports:** date-range controls filter the displayed data; CSV export triggers a download (mock the browser API); "Explain this chart" is present but inert/disabled until the Assistant ships (a test that should be updated, not deleted, when the Assistant lands).
- **Profile:** disabled fields show their explanation tooltip/caption; account-deletion strong-confirmation gate blocks the delete call until the typed confirmation matches; avatar upload/delete both keyboard-operable (a regression test for the `<span onClick>` accessibility bug found in the audit).
- **Navigation:** mobile bottom-nav renders the correct 4–5 items and highlights the active route; desktop account dropdown opens via both click and `Enter`/`Space` keyboard activation (a regression test for the hover-only bug); "More" sheet on mobile contains the secondary nav items.

**Responsive/visual regression (lighter-weight, not full component tests):**
- A small number of viewport-width snapshot or layout-assertion tests (e.g., "at 375px, the transaction table is not rendered; at 1024px, it is") for the two or three components where mobile/desktop truly render different DOM (post-refactor, this should be a short list — most of today's `isMobile` branches are eliminated by CSS-only responsive design per §6.1, leaving fewer places that need this kind of test).

**Explicitly deferred to the Assistant implementation task (not this plan's scope):** any test asserting AI response content, tool-call correctness, or conversation persistence — those depend on backend work not covered here. The Assistant *shell* tests in this phase are limited to "renders the empty/loading/error states correctly" and "starter-question chips populate the input" — pure UI, no AI behavior.

---

## 16. Explicit Non-Goals for This Task

Restating the constraints this planning document deliberately stayed inside:

- No application code was written or modified.
- No Tailwind config, `index.css`, or any component file was changed — every token/value in `docs/DESIGN_SYSTEM.md` is a proposal.
- No Supabase schema, RLS policy, RPC, or Edge Function was touched or proposed for change (the period-scoping/timezone/RLS fixes referenced above as *coordinating* work are already logged in `docs/AUDIT_REPORT.md` as separate backend tasks, not part of this plan).
- No AI Assistant behavior, provider, prompt, or backend architecture was designed — only its navigation placement and empty UI shell (§10, §13 phase 10).
- Nothing in `docs/FRONTEND_REVAMP_PLAN.md` or `docs/DESIGN_SYSTEM.md` should be treated as approved for implementation until you've reviewed §12's decision list and selected/approved Stitch output for the screens in §11.
