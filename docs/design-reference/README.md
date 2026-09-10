# Nexali Design Reference

**Status:** Approved final Stitch design exports, organized for implementation reference. No frontend implementation has started from these files.

## Brand

Product: **Nexali**
AI Assistant: **Aura** (the assistant lives inside Nexali, it is not a separate product name)

Nexali is the official product name, effective now. The following names appear in the raw Stitch export files in this directory and in earlier planning notes, and are obsolete:

- Apex Finance
- FinSovereign
- JV Dumpy

These older names still appear literally inside the unmodified screenshots and `.html` files below (see Coverage), because the design references themselves are not edited as part of documentation updates. Treat every occurrence of an obsolete name in those files as a placeholder to replace with Nexali during implementation, not as guidance to keep multiple product names.

## Visual Source of Truth

When references disagree, use this priority order:

1. `docs/MASTER_SPEC.md` for product requirements and behavior.
2. Final approved Stitch screenshots for visual layout and composition.
3. `docs/DESIGN_SYSTEM.md` for shared design-system rules and color priority.
4. `shared/design-tokens.md` (Stitch-generated) as supporting reference where it does not conflict with `docs/DESIGN_SYSTEM.md`.
5. Existing working application behavior should be preserved unless the specification requires a change.

In practice, this means:

- Use the Stitch screenshots for layout, composition, component placement, spacing relationships, page hierarchy, and overall visual direction.
- Use `docs/DESIGN_SYSTEM.md` for color roles specifically: green is the primary product color and blue is the secondary and accent color. `shared/design-tokens.md` assigns blue as primary and green as secondary; that assignment does not apply. Do not switch the application to a blue-primary system because of the Stitch token file.
- A dedicated mobile reference (`dashboard-mobile.png`) overrides generic responsive assumptions where one exists.
- Tablet layouts are derived responsively from the desktop and mobile references; no tablet reference exists in this export.
- Existing working business logic is not changed just to match a screenshot.
- Accessibility and responsive usability take priority when a screenshot cannot literally fit a smaller viewport.

## What this directory is

The approved Google Stitch design exports for the frontend revamp (see `docs/FRONTEND_REVAMP_PLAN.md` and `docs/DESIGN_SYSTEM.md`), extracted from `stitch_responsive_dark_budget_dashboard.zip` (kept in this directory, unmodified) and organized one folder per page/surface. Each page folder holds:

- `<name>.png`, the approved screenshot. **This is the primary approved reference** for that page.
- `<name>.html`, the Stitch-generated markup/CSS for that screen, kept as a secondary reference (exact classes, spacing, structure Stitch produced). Useful during implementation, but the screenshot is the visual authority, not this file (see Visual Source of Truth above).

## Coverage

**Desktop references exist for every page:**

| Folder | File |
|---|---|
| `dashboard/` | `dashboard-desktop.png` |
| `transactions/` | `transactions-desktop.png` |
| `budgets/` | `budgets-desktop.png` |
| `reports/` | `reports-desktop.png` |
| `assistant/` | `assistant-desktop.png` |
| `profile/` | `profile-desktop.png` |
| `account/` | `account-desktop.png` |
| `settings/` | `settings-desktop.png` |
| `notifications/` | `notifications-desktop.png` |
| `landing/` | `landing-desktop.png` |
| `auth/` | `sign-in-desktop.png`, `sign-up-desktop.png`, `forgot-password-desktop.png`, `reset-password-desktop.png`, `email-verification-desktop.png` |

**Mobile reference:** `dashboard/dashboard-mobile.png` is the **only** dedicated mobile export, and it's an important one — it's the sole concrete reference for mobile top-header treatment, the 5-item bottom tab bar (Dashboard · Transactions · Budgets · Assistant · More — matching `docs/FRONTEND_REVAMP_PLAN.md` §9.3's proposal), mobile card density, and mobile information hierarchy. Treat it as the mobile pattern to extend to every other page, not a Dashboard-only reference.

**No tablet references exist.** Per this organization task's scope, none were created. Tablet layouts are derived responsively during implementation from the desktop and mobile references, per Visual Source of Truth above.

**Navigation:** `navigation/navbar-desktop.png` is a dedicated copy of `dashboard/dashboard-desktop.png` (byte-identical, not cropped or modified) kept here specifically so the canonical authenticated desktop navbar is easy to find without opening a full page screenshot. All seven desktop app screens (`dashboard`, `transactions`, `budgets`, `reports`, `assistant`, `profile`, `account`) show this same navbar. On the left: the logo and product name, rendered in the screenshot as "Apex Finance" and to be implemented as **Nexali**. In the center: Dashboard, Transactions, Budgets, Reports, Assistant. On the right: notifications bell, settings gear, profile avatar with chevron. `settings/settings-desktop.png` and `notifications/notifications-desktop.png` were exported without the top nav bar in frame.

**Shared:** `shared/design-tokens.md` is the Stitch-generated design-system spec (colors, typography, spacing, radii, elevation, component notes), kept exactly as exported. It is a supporting reference only. Where it conflicts with `docs/DESIGN_SYSTEM.md`, most notably its primary and secondary color assignment, `docs/DESIGN_SYSTEM.md` wins. See Visual Source of Truth above.

**Archive:** empty. No duplicate or superseded screens were found in this export. Every folder in the source ZIP mapped to exactly one expected page.

## Folder structure

```
docs/design-reference/
  stitch_responsive_dark_budget_dashboard.zip   ← original export, unmodified
  README.md                                     ← this file
  dashboard/       dashboard-desktop.{png,html}, dashboard-mobile.{png,html}
  transactions/    transactions-desktop.{png,html}
  budgets/         budgets-desktop.{png,html}
  reports/         reports-desktop.{png,html}
  assistant/       assistant-desktop.{png,html}
  profile/         profile-desktop.{png,html}
  account/         account-desktop.{png,html}
  settings/        settings-desktop.{png,html}
  notifications/   notifications-desktop.{png,html}
  landing/         landing-desktop.{png,html}
  auth/            sign-in-desktop.{png,html}, sign-up-desktop.{png,html},
                    forgot-password-desktop.{png,html}, reset-password-desktop.{png,html},
                    email-verification-desktop.{png,html}
  navigation/       navbar-desktop.png (copy of dashboard-desktop.png)
  shared/           design-tokens.md
  archive/          (empty — see archive/README.md)
```
