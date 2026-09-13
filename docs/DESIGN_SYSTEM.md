# Budget Tracker — Design System (v0, Initial Draft)

**Status:** Proposal — not implemented. No application code, Tailwind config, or CSS has been changed to produce this document.
**Companion document:** `docs/FRONTEND_REVAMP_PLAN.md` (page-by-page audit, implementation sequence, approval list).
**Audience:** Whoever implements the frontend revamp, and whoever produces Stitch screens — this is the shared vocabulary both should use.

This is a *v0 draft*. Section 13 lists every value that should be confirmed (or replaced) against approved Stitch screens before implementation begins. Nothing here is final.

**Revision (visual audit pass, post-Phase 3):** the color-priority decision in §2.1 below is reversed. Earlier drafts of this document made green the primary interface color; that is no longer correct. **Nexali's primary interface color is a periwinkle blue (~`#ADC6FF`)**, matching the approved Stitch/reference direction and `docs/design-reference/shared/design-tokens.md`'s original `primary` value. Green is reserved for semantic meaning only (income, success, positive movement) and must not be used for generic primary actions, navigation-active states, or brand emphasis. See §2.1 for the full token set.

**Revision (Lovable visual-foundation integration, Part 1):** `lovable_design/` — an exported Lovable frontend prototype — is now the approved visual reference for shared tokens, hierarchy, spacing, surfaces, and shared UI primitives (not for its app architecture: Nexali keeps React Router, Vite, Tailwind 3, and its own Supabase/TanStack Query stack; Lovable's TanStack Start/Router, Bun, and Tailwind 4 build tooling were not adopted). Its real `src/styles.css` defines every color as an `oklch(L C H)` value rather than Nexali's previous HSL triples; §2.1's token table and `src/index.css` now store the bare `L C H` components of those real values (consumed as `oklch(var(--x))`, mirroring the old `hsl(var(--x))` pattern) instead of approximated HSL numbers. This pass also adopted: Lovable's Material-Design-3-style surface ladder (`--surface-lowest` → `--surface-highest`, plus `--outline`/`--outline-variant`, see §6), its five-tier radius scale on a `0.75rem` base (see §5), its `--shadow-elevated` and real `color-mix()`-based `--shadow-primary-glow` formula, and its global `:focus-visible` outline + `::selection` rules. Green/red/amber remain semantic-only, unchanged by this pass. The app is still dark-only — no light palette was introduced.

---

## Brand

Product: **Nexali**
AI Assistant: **Aura**

Earlier planning material and the raw Stitch export in `docs/design-reference/` referred to the product as "Apex Finance," "FinSovereign," or "JV Dumpy." All three are obsolete. Every token, component, and page referenced below belongs to Nexali. See `docs/design-reference/README.md` for the full visual source-of-truth hierarchy.

---

## 0. Starting point — what already exists

The current app already has a coherent seed: a dark financial dashboard aesthetic with gradients and rounded cards (`src/index.css`, `tailwind.config.js`). The design system below **keeps that seed** and formalizes it — it does not invent a new visual identity. Concretely, it keeps:

- The dark-first `--background`/`--card`/`--primary` (periwinkle blue) / `--secondary` (muted cool gray) HSL token structure.
- `bg-gradient-card`, `bg-gradient-hero`, `bg-gradient-primary` as the app's signature surfaces.
- shadcn/Radix UI primitives (`Button`, `Input`, `Select`, `Popover`, `DropdownMenu`, `Sheet`) as the component foundation — proven, accessible, and already integrated.

What it fixes: five different border-radius values in use with no rule for which to pick (`rounded-full`, `rounded-xl`, `rounded-lg`, `rounded-2xl`, and the `rounded-x1` typo), a `--success` color referenced in `Card.tsx` that doesn't exist in either token set, a `.dark` class block in `index.css` that nothing ever toggles and that would replace the primary accent with near-white if it were, hardcoded `text-white` scattered through form controls instead of theme tokens, and financial status (budget gauge) conveyed by color alone.

---

## 1. Design Principles

1. **Data-dense but calm.** This is a financial app people check daily — legibility and scan-ability beat decoration. Charts and numbers are the content; gradients and glow are accents, not the point.
2. **One rounding scale, applied by role, not by feel.** See §5.
3. **Never color-alone.** Every status (over budget, income vs. expense, success/error) pairs an icon or label with color. Required by `docs/MASTER_SPEC.md` ("Do not communicate financial status using color alone") and by WCAG 1.4.1.
4. **Mobile-first, not mobile-shrunk.** Layouts are built from a single-column base upward with Tailwind breakpoints, not built for desktop and then conditionally swapped via `useIsMobile()` JS branching (the current app's approach — see revamp plan §6.1).
5. **One card, one meaning.** A card's visual weight (shadow, border, gradient) should track its importance in a page's hierarchy, not be applied uniformly to every rectangle.
6. **Every async state has a designed state.** Loading, empty, and error are first-class, not an inline ternary with plain text. See §10–12.
7. **Respect the user's system.** `prefers-reduced-motion`, `prefers-color-scheme`, and eventual theme choice are inputs to the design, not afterthoughts.

---

## 2. Color

### 2.1 Semantic token table

All colors are the real values from `lovable_design/src/styles.css` (the approved visual reference), stored as bare `oklch` components in CSS custom properties (`src/index.css`) and mapped into Tailwind's `theme.extend.colors` via `oklch(var(--x))` — replacing the previous HSL-triple/`hsl(var(--x))` pattern. `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, and `--accent-foreground` all alias directly to `--foreground` (`var(--foreground)`), matching Lovable's own simplification instead of carrying separate near-duplicate values.

| Token | Current value (dark, oklch L C H) | Role | Change from today |
|---|---|---|---|
| `--background` | `0.1864 0.0088 264.34` | App background | Real Lovable value (was an approximated HSL triple) |
| `--foreground` | `0.9145 0.0081 286.24` | Primary text | Real Lovable value |
| `--card` / `--popover` | `0.2091 0.0104 268.19` | Card surface, dropdowns/popovers | Real Lovable value |
| `--card-foreground` / `--popover-foreground` / `--secondary-foreground` / `--accent-foreground` | `var(--foreground)` | Text on those surfaces | Simplified to alias `--foreground` directly, per Lovable's `@theme inline` block |
| `--primary` | `0.8281 0.0851 266.17` (periwinkle blue, ~`#ADC6FF`) | Primary actions, active nav, links, focus accents, selected states | **Brand color**, real Lovable value |
| `--primary-foreground` | `0.2144 0.115 257.73` | Text on primary | Dark, not white — `--primary` is a light/bright surface, so its foreground must stay dark for contrast (WCAG AA) |
| `--primary-glow` | `0.91 0.045 266.17` | Gradient highlight (`bg-gradient-primary`) only | Lighter tint of primary; Lovable itself has no equivalent token (it has no gradients) — kept only because `bg-gradient-primary` still has call sites |
| `--secondary` / `--accent` | `0.2846 0.0079 264.44` | Secondary/tertiary actions, hover/selected surfaces | Same real value as `--surface-high` — deliberately a neutral, not a second blue |
| `--muted` | `0.2431 0.0082 264.41` | De-emphasized surfaces | Same real value as `--surface` |
| `--muted-foreground` | `0.8283 0.0227 274.68` | De-emphasized text | Real Lovable value |
| `--surface-lowest` → `--surface-highest` | `0.1634`/`0.226`/`0.2431`/`0.2846`/`0.3285` (all `0.008–0.009 264.3–264.5`) | Tonal elevation ladder — root background, base surface, elevated card, high surface, input/control surface | New — see §6 |
| `--outline` / `--outline-variant` | `0.655 0.0227 273.87` / `0.3984 0.0229 268.72` | Stronger/softer structural borders (e.g. the `surface` button variant) | New |
| `--destructive` / `--destructive-foreground` | `0.8383 0.0891 26.76` / `0.2275 0.1336 27.32` | Errors, delete, expenses, over-budget | Real Lovable value |
| `--success` / `--success-foreground` | `0.8063 0.1948 149.26` / `0.3011 0.0834 149.76` (green) | Positive confirmation, income, under-budget | **Semantic only** — never used for generic primary actions or brand emphasis |
| `--warning` / `--warning-foreground` | `0.8342 0.1335 71` / `0.3142 0.0682 69.76` (amber) | Approaching budget limit (75–95%) | Real Lovable value |
| `--border` / `--input` | `0.3984 0.0229 268.72` (same as `--outline-variant`) | Borders, input borders | Bare value, unchanged by opacity-modifier classes (`border-border/20` etc.); the default unmodified `*` border reset bakes in Lovable's 45% alpha directly (see §6) |
| `--ring` | `0.8281 0.0851 266.17` (= `--primary`) | Focus ring | Unchanged role |
| `--radius` | `0.75rem` | Base radius (see §5) | Was `1rem` — now matches Lovable's real base, used as the *large* tier |

**Primary and secondary roles: blue is primary, green is reserved for semantic success/income/positive meaning only.** Unchanged by this pass. This document remains the color-priority source of truth per `docs/design-reference/README.md`'s Visual Source of Truth section.

**Dropped as unused:** `--primary-hover` (buttons now use the opacity modifier `hover:bg-primary/90`, matching Lovable's real Button exactly), `--primary-muted`, `--primary-border`, `--primary-ring` (had no call sites — `--ring` already carried the same value directly), and `--gradient-secondary` (had no call sites).

### 2.2 What's explicitly removed

- **The `.dark` class block in `index.css`.** It's dead (nothing toggles a `.dark` class anywhere in the app), and if it were ever activated it would swap the signature blue/dark financial palette for a generic near-white shadcn default — a regression, not a feature. If a light/dark theme toggle is added later (not currently scoped), it needs its own designed light palette that preserves the primary-blue identity, not this leftover scaffold.
- **Inline hex/hsl color literals** in components (`#f87171`, `#34d399` in the old `Dashboard.tsx` — already removed during stabilization; `hsl(142 76% 36%)` / `hsl(48 96% 53%)` / `hsl(0 80% 60%)` in `Card.tsx`'s `getColor()` — to be replaced by `--success` / `--warning` / `--destructive` tokens).

### 2.3 Category / merchant color coding (new)

Reports and category breakdowns need a stable, distinguishable color per category for charts and legends. Propose a fixed 8–10 color categorical palette derived from existing tokens plus a few additions (e.g., success green, warning amber, a purple, a pink, a teal, muted gray for "Other" — deliberately not built from primary blue, which is reserved for brand/interactive emphasis, not per-category coding), assigned deterministically by category name hash so the same category always gets the same color across the Dashboard, Reports, and Assistant. **Still needs Stitch confirmation** — see §13. (Transactions' category badges took the more conservative route in the meantime: one neutral badge style for every category, not a per-category color, since this palette isn't approved yet — see the Phase 3 visual audit report.)

### 2.4 Contrast

Every text/background pairing above meets WCAG AA at the sizes used (the existing dark-on-dark `--muted-foreground` on `--card` combo is borderline and should be spot-checked with a contrast tool during implementation, not assumed). `text-white` hardcoded onto form inputs throughout `FieldSet.tsx`/`CategoryPicker.tsx`/`Card.tsx` should be replaced with `text-foreground` or `text-card-foreground` so contrast stays correct if the palette ever shifts.

---

## 3. Typography

The app has no defined type scale today — `text-6xl`, `text-4xl`, `text-2xl`, `text-xl`, `text-lg` etc. are picked ad hoc per component (e.g., three different page-title sizes exist: `text-4xl` on Profile, `text-4xl sm:text-5xl lg:text-6xl` on Budgets, an animated `text-2xl md:text-4xl lg:text-6xl` on Dashboard).

### 3.1 Font

Keep the system font stack currently inherited from Tailwind's default (no custom font is loaded today, and none is required by the spec). If a display font is wanted for the marketing/landing page, that's a Stitch-stage decision (§13), not a default.

### 3.2 Proposed scale (role-based, mobile value → desktop value)

| Role | Mobile | Desktop (`md:`+) | Weight | Usage |
|---|---|---|---|---|
| Display | `text-3xl` | `text-5xl` | `font-extrabold` | Landing hero headline only |
| Page title | `text-2xl` | `text-3xl` | `font-bold` | One per page: "Dashboard", "Budgets", "Transactions", "Reports", "Assistant", "Profile" |
| Section heading | `text-lg` | `text-xl` | `font-semibold` | Card group headers ("Regional Preferences", "Recent Transactions") |
| Card title | `text-base` | `text-lg` | `font-semibold` | Individual card headers (`BudgetCard`'s category name, widget titles) |
| Body | `text-sm` | `text-base` | `font-normal` | Default paragraph/label text |
| Caption / meta | `text-xs` | `text-sm` | `font-medium`, `text-muted-foreground` | Timestamps, helper text, counts |
| Numeric emphasis | `text-2xl`–`text-3xl` | `text-3xl`–`text-4xl` | `font-bold`, tabular numerals | Dashboard totals, budget remaining figures |

Numeric emphasis should use `font-variant-numeric: tabular-nums` (a one-line Tailwind arbitrary utility, `[font-variant-numeric:tabular-nums]`, or a `.tabular-nums` utility class) so money figures don't visually jitter as digits change — currently absent, and noticeable on the Dashboard's live totals.

### 3.3 Line length & measure

Body copy (Landing page paragraphs, empty-state text, error messages) should be capped at `max-w-prose` or `max-w-md` depending on container — several Landing page paragraphs currently rely on the outer container width alone.

---

## 4. Spacing

No spacing scale is documented today; values are chosen per component (`p-6`, `px-6 lg:px-14`, `gap-4`, `gap-6`, `space-y-8`, `space-y-6`, `space-y-4` all appear without an evident rule).

### 4.1 Proposed scale (Tailwind defaults, used consistently by role)

| Role | Value | Usage |
|---|---|---|
| Page horizontal padding | `px-4` (mobile) → `px-6` (`sm:`) → `px-8` (`lg:`) | Every page's outer container |
| Page vertical rhythm | `py-6` (mobile) → `py-8` (`lg:`) | Space above/below page content, between major sections |
| Card padding | `p-4` (mobile) → `p-6` (`sm:`+) | Every card interior |
| Stack spacing (related fields/items) | `space-y-2` | Label + input, list rows |
| Stack spacing (related blocks) | `space-y-4` | Form field groups |
| Stack spacing (major sections) | `space-y-6` to `space-y-8` | Between distinct card groups on a page |
| Grid gap | `gap-4` (mobile) → `gap-6` (`lg:`+) | Card grids (Budgets, Dashboard widgets) |
| Touch target minimum | `min-h-11 min-w-11` (44×44px) | Every tappable control — currently unenforced; several icon-only buttons (pagination arrows, filter `X` chips) are visibly smaller |

This isn't a new scale — it's Tailwind's existing default spacing scale (`4 = 1rem` steps), just applied by a fixed role table instead of ad hoc per component.

---

## 5. Radius

**Rule: five tiers derived from one base, chosen by element role, not by eye.** Matches Lovable's real scale exactly: base `--radius: 0.75rem`, with `sm`/`md`/`xl`/`2xl` derived via `calc()` (`sm` = base −4px, `md` = base −2px, `lg` = base, `xl` = base +4px, `2xl` = base +8px).

| Tier | Value | Token | Usage |
|---|---|---|---|
| Small | `0.625rem` (`rounded-sm`) | `--radius` − 4px | Small chips, tight controls |
| Medium | `0.6875rem` (`rounded-md`) | `--radius` − 2px | Buttons, inputs, badges |
| Large | `0.75rem` (`rounded-lg`) | `--radius` (base) | Compact cards, dropdown/popover panels, table containers |
| Extra-large | `0.8125rem` (`rounded-xl`) | `--radius` + 4px | Primary content cards (`ui/card.tsx`, dialogs) |
| 2xl | `0.9375rem` (`rounded-2xl`) | `--radius` + 8px | Reserved for a single hero surface, not used broadly |
| Full | `rounded-full` | — | Avatars, pills/badges, circular icon buttons |

Base radius moved from `1rem` to `0.75rem` (Lovable's real value) — every element built on the scale (buttons, inputs, cards, dialogs, badges via their own fixed `rounded-md`) picks this up automatically through the token, with no per-component edits needed.

---

## 6. Elevation & Surfaces

**Surface ladder (new, real Lovable tokens):** `--surface-lowest` → `--surface-low` → `--surface` → `--surface-high` → `--surface-highest`, plus `--outline` / `--outline-variant` for structural borders. This is a Material-Design-3-style tonal system layered on top of the base semantic tokens (`--card`, `--popover`, etc.), available as Tailwind utilities (`bg-surface-lowest`, `bg-surface-high`, `border-outline-variant`, ...) so a page can distinguish root background, base surface, elevated card, high surface, and input/control surface without hand-picking opacity values. Not yet applied to any page body in this pass — establishing the tokens is Part 1's scope; using them page-by-page is later work.

| Token | Current value | Usage |
|---|---|---|
| `shadow-card` | `0 20px 40px -12px oklch(var(--background) / 0.4)` | Default resting elevation for cards |
| `shadow-glow` | `0 0 40px oklch(var(--primary) / 0.3)` | Reserved for surfaces not yet visually corrected (Budgets); no longer applied to primary buttons or nav |
| `shadow-elevated` | `0 18px 40px -24px oklch(0 0 0 / 0.9)` | New — Lovable's real elevated-surface shadow, not yet applied anywhere |
| `shadow-primary-glow` | `0 10px 30px -12px color-mix(in oklab, oklch(var(--primary)) 35%, transparent)` | Real Lovable formula, now used by `Button variant="hero"` (previously an invented approximation) |
| `bg-gradient-card` | `linear-gradient(135deg, oklch(var(--card)), oklch(var(--surface-high)))` | Default card surface — keep as the app's signature texture |
| `bg-gradient-hero` | `linear-gradient(135deg, oklch(var(--background)), oklch(var(--card)))` | Full-page backgrounds (auth pages, landing) |
| `nexali-panel` (utility) | `background: color-mix(in oklab, oklch(var(--card)) 80%, transparent); border: 1px solid oklch(var(--border) / 45%); backdrop-filter: blur(12px);` | New — Lovable's glass-panel treatment, translated to a Tailwind 3 `@layer utilities` class; not yet applied anywhere |
| Border | `border border-border/20` (cards), `border border-border/10` (dividers); default unmodified border color now bakes in Lovable's 45% alpha | Keep — subtle hairline, not a heavy outline |

**Revised rule (visual audit pass):** primary call-to-action buttons (`variant="hero"`) are a **flat** solid-`--primary` surface with an opacity-based `hover:bg-primary/90` state (matching Lovable's real Button exactly) plus the real `shadow-primary-glow`, not a gradient-plus-scale treatment invented from a screenshot. `shadow-glow` is kept as a utility (still used by Budgets, not corrected this pass).

---

## 7. Cards

One `Card` primitive (`ui/card.tsx`, currently unused shadcn scaffolding — see revamp plan) becomes the base for every card in the app, replacing the current pattern where `Card.tsx`, `Dashboard.tsx`'s inline widgets, `Modal.tsx`'s dialog bodies, and `BudgetCard` each hand-roll their own `<div className="bg-gradient-card border ...">` wrapper independently.

**Card anatomy:**
- Container: `bg-gradient-card border border-border/20 shadow-card rounded-xl` (Large radius tier), padding per §4.
- Optional header: icon + title (`text-lg font-semibold`), optional trailing action/badge.
- Body: content-specific.
- Optional footer: actions, right-aligned on desktop / stacked full-width on mobile.
- Hover (only for interactive/clickable cards): `hover:shadow-glow hover:scale-[1.01]` — **not** applied to static display cards (current inconsistency: `BudgetCard` scales on hover even though clicking the card itself does nothing; only its Edit/Delete buttons are interactive).

**Card variants (by role, not by ad hoc styling):**
- **Stat card** — a single large number + label + trend indicator (Dashboard totals).
- **Content card** — chart or list inside a titled card (category breakdown, recent transactions).
- **Entity card** — represents a single record with actions (BudgetCard, mobile transaction card).
- **Form card** — a card wrapping a form (auth pages, modals).

---

## 8. Buttons

The existing `Button` primitive (`ui/button.tsx`) is **preserved as-is architecturally** (Radix `Slot`-based, `class-variance-authority`) — this is good, centralized, accessible work already in the codebase and remains the foundation. Its variant set was extended, not replaced, with two real Lovable variants: `brand` (kept under the existing `hero` name so call sites didn't need touching — flat primary fill, `font-semibold`, the real `shadow-primary-glow`, `active:scale-[0.98]`) and `surface` (a new variant: bordered `surface-lowest` background, `outline-variant` border, hover lifts to `surface-high` and picks up a primary border — for lower-emphasis actions needing more weight than `ghost`/`outline`). Two sizes were added: `control` (`h-11 rounded-lg`, a taller touch-friendly control size) and `icon-lg` (`h-11 w-11 rounded-lg`). All previously-existing variant/size names (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `glow`, `sm`, `lg`, `icon`) keep their call sites working unchanged. Focus styling moved from a per-component `ring-2` + `ring-offset-2` to a subtler `ring-1` (matching Lovable's real Button), relying on the new app-wide `:focus-visible` outline (§18) as the primary strong indicator instead of stacking two focus treatments.

**Additions/clarifications:**
- **Icon-only buttons must always carry `aria-label`.** Today several (`Menu` trigger, pagination chevrons, `X` filter-remove) rely on the icon alone. This is a component-contract rule, not a new variant.
- **`size="icon"` (already defined, `h-10 w-10`) should be the only icon-button size used** — audit found ad hoc smaller icon buttons (`h-8 w-8` pagination controls) that fall under the 44×44px touch target minimum on mobile.
- **Destructive actions get a two-step confirm, not a native `confirm()` dialog.** A `Button variant="destructive"` inside a confirmation `Dialog`/`AlertDialog` pattern (see §9), replacing today's `window.confirm()`/`alert()` calls for transaction/budget/account deletion.
- **Button hierarchy per screen:** exactly one `hero`/primary button as the main call-to-action; `outline`/`ghost` for secondary actions; `destructive` reserved for delete/remove only, never for "cancel."

---

## 9. Inputs & Forms

**Preserve:** `Input`, `Label`, `Select` (Radix-based) — solid, accessible foundations.

**New/standardized patterns:**
- **Field group:** `Label` + control + optional helper text + optional error text, as one composed unit (`FormField`) so every form (currently 4 different hand-rolled forms in `FieldSet.tsx` alone) renders labels/errors identically instead of each form inventing its own spacing and error-display convention.
- **Inline validation:** errors render below the field in `text-destructive text-sm`, paired with `aria-invalid`/`aria-describedby` on the input — not today's pattern of a single form-level error banner disconnected from the offending field (e.g., `AddBudget`'s single `{error}` block for four possible field problems).
- **Required-field marking:** consistent `*` suffix on the label (already used in `AddField`/`AddBudget`, should extend everywhere) plus `aria-required`.
- **Password visibility toggle:** new — an eye-icon `Button variant="ghost" size="icon"` inside the password `Input`, addressing the spec's explicit "password visibility" requirement (currently absent).
- **Disabled-but-visible fields** (Profile's read-only Full Name/Email, and the currently-disabled Currency/Number Format selects) get a consistent `bg-muted text-muted-foreground cursor-not-allowed` treatment with a small explanatory caption ("Set during sign-up," "Coming soon") instead of silently doing nothing when clicked.

---

## 10. Dialogs, Sheets & Overlays

**Current state:** native `<dialog>` elements opened imperatively via `ref.showModal()` (good — native dialogs get focus-trapping and Escape-to-close for free) *and*, inconsistently, via `document.getElementById(...).showModal()` from a different component (`Budgets.tsx`, `TransactionTable.tsx` opening `Modal`'s dialogs by DOM id instead of the `Modal` component's own ref). Radix `Dialog` primitives exist in the dependency tree (used by `Sheet`) but the standalone `Dialog`/`DialogContent` wrapper was dead code and was removed during stabilization.

**Proposed standard:**
- **Desktop/tablet modals** (Add/Edit Transaction, Add/Edit Budget, confirmations): Radix `Dialog` (re-added as a thin `ui/dialog.tsx` wrapper, styled to match the card system — centered, `rounded-xl`, `bg-gradient-card`), replacing the native-`<dialog>`-plus-`getElementById` pattern. Radix gives correct `aria-modal`, labelled-by, and focus-restoration behavior for free, which native `<dialog>` needs to be wired up manually to get right.
- **Mobile modals:** the same content renders full-screen (Radix `Dialog` content styled `inset-0 rounded-none` at the `sm:` breakpoint and below), not a shrunk desktop dialog — this matches the spec's explicit requirement for the future Assistant and should extend to every mobile form.
- **Mobile navigation / filter panels:** `Sheet` (already implemented, already good) stays as the pattern for slide-in panels — used today for the mobile nav menu and the transaction filter sheet.
- **Confirmations (delete transaction/budget/account):** a dedicated `ConfirmDialog` built on the same `Dialog` primitive, title + consequence description + Cancel/Confirm, `Confirm` styled `destructive` for delete actions — replacing every `window.confirm()`/`alert()` call in the app (`Profile.tsx`, `Budgets.tsx`, `TransactionTable.tsx`). Account deletion — the most destructive action in the app — gets the strongest confirmation tier: typed confirmation (e.g., type "DELETE" or the user's email) rather than a single Confirm click, per the spec's "Deletion should require a stronger confirmation than creation or editing" principle (written for the future AI assistant, but the principle applies today).

---

## 11. Navigation

Full navigation structure (desktop/mobile/tablet layouts, route lists, and the Assistant's placement) is proposed in `docs/FRONTEND_REVAMP_PLAN.md` §8. This section defines the *visual* system only.

- **Desktop top nav:** sticky, `bg-gradient-card border-b border-primary/10`, current pattern — kept. **Active-route styling (revised, visual audit pass):** primary-blue text with a bottom border indicator, matching `navigation/navbar-desktop.png` — not a filled pill. The earlier filled-pill-plus-glow treatment is retired; a filled `bg-primary` pill behind every nav label read as heavier than the approved reference and competed with the flat primary buttons elsewhere on the page.
- **Mobile bottom nav (new):** a fixed bottom tab bar for the 4–5 primary destinations (Dashboard, Transactions, Budgets, Assistant, More), replacing "everything lives in the hamburger `Sheet`" for primary navigation — the `Sheet` remains for secondary items (Profile, Settings, Sign Out) and filters. Bottom nav respects `env(safe-area-inset-bottom)`. Active tab: a small primary-blue pill behind the icon only (matching `dashboard/dashboard-mobile.png`'s composition, in primary blue rather than that screenshot's green — active nav state is brand-primary, not semantic-success).
- **Tablet:** desktop top nav down to a defined breakpoint (see revamp plan §7), collapsing to the mobile pattern below it — no dedicated tablet-only nav chrome, but content layout (grids, split panels) does get tablet-specific treatment (§7 of the revamp plan).
- **Breadcrumbs/back:** not used today and not proposed — the app's hierarchy is flat (one level of pages under the authenticated shell), so a persistent nav is sufficient.

---

## 12. Charts

**Current state:** three ad hoc `PieChart`s (Dashboard, `BudgetCard`) at fixed pixel dimensions (`width={280} height={140}`, `width={200} height={100}`), not responsive, using inline color literals, no accessible text alternative, no legend, tooltip styling duplicated per instance.

**Proposed standard (a `ChartCard` wrapper + a small set of chart primitives, all built on the existing Recharts dependency — not a new charting library):**

- **Always `ResponsiveContainer`.** No fixed-pixel chart ever ships again; every chart scales to its card.
- **Color from tokens, not literals.** Charts pull from the semantic palette (§2) and the categorical palette (§2.3), never inline `hsl(...)` strings.
- **Every chart gets a visually-hidden text summary** (`<span className="sr-only">`) stating the key figures the chart represents ("Spent $340 of $500 budgeted, 68%") — addresses the spec's "accessible chart summaries" requirement and today's total absence of one.
- **Consistent tooltip styling** — one `ChartTooltip` component (background `bg-popover`, border `border-border`, `rounded-lg`, `shadow-card`) instead of each chart instance redefining `contentStyle` inline.
- **Consistent legend** — for multi-series charts (Reports' category breakdown, income-vs-expense trend), a shared `ChartLegend` with color swatch + label + value, keyboard-focusable if it's interactive (e.g., toggling series visibility).
- **Chart type inventory needed for Reports (currently nonexistent, per the spec):** a line/area chart (income vs. expense trend, net cash flow over time), a donut/pie (spending by category — the pattern that already exists on Dashboard/Budgets, generalized), a horizontal bar (top categories/merchants ranked), and a grouped bar or diverging bar (budget vs. actual per category).
- **Loading state:** a skeleton chart shape (not "Loading…" text) — see §10.
- **Empty state:** an illustrated/iconic empty state *inside* the chart card ("No transactions yet this period") rather than rendering an empty/broken chart.

---

## 13. Loading States

**Current state:** inconsistent — plain `"Loading…"` text (Dashboard, Profile, TransactionTable), a `<div>` with `animate-pulse` wrapping *text* rather than a shaped skeleton (Budgets), and totals that just show `"…"` inline (Dashboard widgets).

**Proposed standard — skeleton components matching the shape of their loaded content:**
- `SkeletonText` — a `bg-muted animate-pulse rounded` bar, sized to the text role it replaces (§3).
- `SkeletonCard` — a card-shaped placeholder (matches §7's card anatomy) for stat cards, entity cards.
- `SkeletonChart` — a shape suggesting the chart type (arc for pie/donut, bars for bar charts) so the layout doesn't jump when data arrives.
- `SkeletonRow` — for table rows / mobile list cards.
- **Rule:** every `isLoading` branch in the app renders one of the above, sized to match its loaded counterpart, so nothing "pops" into a different layout when data arrives. Full-page loading (route transitions) uses a centered spinner only when no shell content can render yet (e.g., initial auth check in `AuthGate`); once inside a page, section-level skeletons are always preferred over a full-page spinner.
- **Respects `prefers-reduced-motion`:** the pulse animation is disabled (static `bg-muted` shown instead) when reduced motion is requested.

---

## 14. Empty States

**Current state:** present in `TransactionTable` and `Budgets` (`"No transactions yet"`, `"No bugets yet"` — note the existing typo, to be fixed during implementation) as centered text, no icon, no differentiation between "no data exists" and "no results match your filters."

**Proposed standard — an `EmptyState` component:**
- Icon (relevant lucide icon — e.g., `Receipt` for transactions, `PiggyBank` for budgets, `Search` for filtered-to-nothing).
- Headline (`text-lg font-semibold`).
- Supporting copy (`text-sm text-muted-foreground`, one sentence, explaining *why* it's empty).
- Primary action when applicable ("Add your first transaction" → opens the Add modal directly; "Clear filters" when the emptiness is filter-caused, not data-caused — a distinction the current implementation doesn't make).
- Used consistently across Transactions, Budgets, Reports (once built), and the Assistant's empty conversation state.

---

## 15. Error States

**Current state:** raw `error.message` strings (now type-safe post-stabilization, but still the raw database/network message) rendered as plain red text, inconsistently placed (sometimes centered block, sometimes inline, sometimes a `<p>`, sometimes a `<div>`).

**Proposed standard — an `ErrorState` component:**
- Icon (`AlertTriangle` or similar), headline ("Couldn't load your budgets"), and a **user-safe** message — not the raw Supabase/PostgREST error text, which can leak schema details (flagged as security finding S7 in the audit). Raw error detail, if shown at all, goes behind a collapsed "Details" disclosure, not as the primary message.
- A **Retry** button wired to the query's `refetch()` — none of today's error branches offer retry; the user must reload the page.
- For the future Assistant specifically: a distinct "Assistant unavailable" error state that makes clear the *rest of the app still works* (per the spec's requirement that core budgeting features never depend on the AI service).
- Toast/inline distinction: transient action failures (a save that failed) use a toast-style transient banner (building on the pattern already started in `Profile.tsx`'s save-status message, generalized into a shared `Toast`/`useToast` utility); persistent state failures (a page's data failed to load) use the full `ErrorState` block described above.

---

## 16. Iconography

Keep `lucide-react` (already the icon set in use, tree-shakeable, already a dependency). Proposed conventions:
- **Size:** `h-4 w-4` inline with text, `h-5 w-5` standalone/navigation, `h-8 w-8`+ only for empty/error-state illustrations.
- **Stroke:** default Lucide `strokeWidth={2}` throughout — don't mix stroke weights (currently consistent, worth keeping explicit as a rule).
- **Never icon-only without a label** — either visible text or `aria-label` (§8).

---

## 17. Motion

- `prefers-reduced-motion: reduce` **must** disable or shorten: the Dashboard typewriter effect, the Landing page phased fade-ins, `animate-bounce`/`animate-pulse`/`animate-glow-pulse`, and skeleton pulsing (§13) — none of this is currently gated, and the spec explicitly requires reduced-motion support.
- Standard transition timing stays as defined (`--transition-smooth`, `--transition-bounce` already exist as tokens) — reused, not redefined.
- Hover scale effects (`hover:scale-105`, `hover:scale-[1.02]`) are kept for buttons and primary interactive cards but should be uniform (pick one value, e.g., `1.02`, rather than the current mix of `1.02`/`1.05`/`1.01`-equivalents scattered per component).

---

## 18. Accessibility Baseline (applies to every component above)

- One `<h1>` per page; section headings descend in order (currently violated — Dashboard's welcome text is a `<div>`, not an `<h1>`).
- Every interactive element reachable by keyboard, with a visible focus ring (`focus-visible:ring-2 focus-visible:ring-ring` — already defined on `Button`, needs extending to custom clickable `<span>`/`<div>` elements being replaced with real `<button>`s, see revamp plan).
- Every icon-only control has `aria-label`.
- Dialogs trap focus and restore it to the trigger on close (native `<dialog>` does this automatically; Radix `Dialog` does this automatically — either is fine as long as the `document.getElementById` bypass pattern is retired, see §10).
- Status changes (save success/error, AI response arriving) are announced via `aria-live="polite"` regions, not purely visual toasts.
- Minimum 44×44px touch targets (§4).
- No status conveyed by color alone (§1, §12).

---

## 19. Responsive Breakpoints Reference

Tailwind defaults, used as-is (no custom breakpoints needed):

| Breakpoint | Min-width | Primary target |
|---|---|---|
| *(base)* | 0 | Small phones (iPhone SE, small Android) |
| `sm` | 640px | Standard/large phones in portrait, small phones in landscape |
| `md` | 768px | iPad portrait, large phones landscape |
| `lg` | 1024px | iPad landscape, small laptops |
| `xl` | 1280px | Laptops, desktop |
| `2xl` | 1536px | Large desktop |

Full device-by-device behavior is specified in `docs/FRONTEND_REVAMP_PLAN.md` §7.

---

## 20. Open Items Requiring Approval

These values are proposals, not decisions — flagged here and cross-referenced in the revamp plan's approval list (§13 there):

1. ~~Exact `--success` and `--warning` HSL values (§2.1)~~ — resolved: implemented as `142 71% 45%` (green) and `38 92% 50%` (amber). No longer at risk of reading as "primary action" now that primary is blue, not green.
2. The categorical chart palette for categories/merchants (§2.3) — needs enough distinguishable colors for a household with 8–10+ categories, tested against the dark background.
3. Whether a light theme is in scope at all right now, given `.dark` is currently dead code (§2.2) — if yes, it needs its own designed palette, not the leftover shadcn default.
4. Landing-page-only display typography (§3.2) — whether it stays system-font or adopts a display font.
5. Final bottom-nav item set for mobile (Dashboard/Transactions/Budgets/Assistant/More vs. an alternative grouping) — see revamp plan §8.
