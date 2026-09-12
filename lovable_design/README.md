# Nexali Visual Studio

IMPORTANT PROJECT CONTEXT

This Lovable project is a FRONTEND-ONLY design implementation.

It is intentionally separate from my real Nexali application right now.

The real Nexali application already has:

- Supabase

- authentication

- transactions

- categories

- budgets

- TanStack Query

- real data hooks

- backend functions

- validation

- business logic

NONE of that backend functionality needs to be recreated in this Lovable project.

I will integrate this frontend into the real Nexali repository later on a separate Git branch.

Your job here is to build the COMPLETE VISUAL FRONTEND and RESPONSIVE COMPONENT SYSTEM.

==================================================

DO NOT BUILD A BACKEND

==================================================

Do NOT:

- configure Supabase

- create database tables

- create migrations

- create RLS policies

- create Edge Functions

- create RPCs

- create authentication infrastructure

- create API endpoints

- create server actions

- create a new backend

- invent backend architecture

- attempt to reproduce Nexali's database

This project is design/frontend only.

==================================================

MOCK DATA IS ALLOWED HERE

==================================================

Because this is a standalone frontend design project, realistic mock data is allowed for demonstrating layouts.

For example, you may use sample:

- transactions

- budgets

- categories

- reports

- notifications

- profile information

However:

Mock data must be clearly separated from presentation components.

Do not deeply embed fake data directly throughout page JSX.

Prefer something like:

src/

  mock/

    transactions.ts

    budgets.ts

    notifications.ts

or another clean equivalent.

This will make it easy for me to replace mock data with my real Nexali hooks later.

==================================================

BUILD FOR LATER INTEGRATION

==================================================

Design components so they can later receive real data through props.

For example:

TransactionRow

should receive transaction information through props.

BudgetCard

should receive budget information through props.

ProfileAvatar

should receive image/name information through props.

Do not tightly couple visual components to fake data.

Keep presentation and data separate whenever practical.

==================================================

NO FAKE NETWORK LOGIC

==================================================

Do not create fake APIs just to make the frontend appear functional.

For interactions such as:

- Add Transaction

- Edit Transaction

- Delete Transaction

- filters

- category selection

- settings

- profile editing

it is fine for the design prototype to demonstrate the interaction locally.

Examples:

- opening a dialog

- showing validation

- changing local mock state

- opening sheets

- selecting filters

- showing confirmation dialogs

But do not invent server endpoints.

The real functionality will be connected later.

==================================================

PRIMARY GOAL

==================================================

The goal of this project is to give me a production-quality VISUAL FRONTEND that I can integrate into the real Nexali codebase later.

Focus heavily on:

- page composition

- responsive behavior

- reusable components

- visual fidelity to the supplied ZIP

- desktop

- iPad/tablet

- iPhone/Android

- mobile app-style navigation

- accessibility

- component consistency

- clean React structure

==================================================

DESIGN SOURCE OF TRUTH

==================================================

The attached ZIP contains the approved Nexali designs.

Those designs are the visual source of truth.

Desktop screenshots are the main references.

Tablet and mobile designs must be derived from them.

Do not merely shrink the desktop layouts.

Create intentional responsive designs that preserve:

SAME BRAND

+

SAME PAGE

+

SAME INFORMATION HIERARCHY

+

RESPONSIVE RECOMPOSITION

==================================================

BRAND

==================================================

Product:

Nexali

AI assistant:

Aura

Dark-only design.

Primary brand color:

soft blue/periwinkle approximately #ADC6FF

Primary blue:

- main CTA buttons

- selected navigation

- active tabs

- focus states

- active pagination

- interactive emphasis

Semantic colors:

Green:

- success

- income

- positive status

Red:

- errors

- destructive actions

- expenses / negative values

Amber:

- warnings

Do not use green as the general primary brand color.

==================================================

SHARED DESKTOP NAVIGATION

==================================================

All authenticated desktop pages must use the SAME shared top navigation.

Left:

- Nexali logo/icon

- Nexali

Center:

- Dashboard

- Transactions

- Budgets

- Reports

- Aura

Right:

- Notifications

- Settings

- Profile avatar

- dropdown chevron

Do not create separate navbar implementations for each page.

==================================================

MOBILE APP NAVIGATION

==================================================

For iPhone/Android-sized layouts, design Nexali like a real mobile application.

Top app bar:

Left:

- Nexali icon/logo

Right:

- Notifications

- Settings

- Profile avatar

Use a compact layout appropriate for mobile.

Bottom navigation:

1. Dashboard

2. Transactions

3. Budgets

4. Aura

5. More

Use:

- icon

- short label

Active item uses Nexali primary blue.

The bottom navigation should be fixed and should respect device safe areas.

Content must include enough bottom padding so the navigation never covers page content.

==================================================

MORE MENU

==================================================

The mobile More destination should expose secondary destinations such as:

- Reports

- Profile

- Account

- Settings

- Notifications

- Sign Out

Use an app-style sheet/drawer.

==================================================

RESPONSIVE TARGETS

==================================================

DESKTOP:

1280

1366

1440+

TABLET:

768

820

834

1024

834px portrait is especially important.

MOBILE:

320

375

390

414

430

Design deliberately for all three classes.

==================================================

TABLET PHILOSOPHY

==================================================

Tablet should look like the desktop design adapted intelligently.

Do not simply scale everything down.

Possible adaptations include:

- wrapping toolbars

- fewer card columns

- two rows of controls

- smaller gaps

- stacked secondary panels

- compact table columns

- selectively hiding low-priority labels

Tablet should still clearly resemble desktop Nexali.

==================================================

MOBILE PHILOSOPHY

==================================================

Mobile may change the arrangement significantly when necessary.

Examples:

Desktop transaction table

→ Mobile transaction cards

Desktop filter toolbar

→ Search + Filter button + Sheet

Desktop two-column analytics

→ Mobile vertical stack

Desktop centered modal

→ Mobile full-screen sheet/dialog

Desktop multi-column budget cards

→ Mobile single-column cards

These are responsive adaptations of the SAME page, not separate visual identities.

==================================================

COMPONENT ARCHITECTURE

==================================================

Build reusable frontend components rather than duplicating page markup.

Examples:

AppNav

MobileTopBar

MobileBottomNav

MobileMoreSheet

PageContainer

Button

Input

Badge

Dialog

Sheet

EmptyState

StatusBanner

TransactionTable

TransactionCard

TransactionFilters

TransactionForm

BudgetCard

BudgetProgress

ReportCard

ChartContainer

SettingsSection

SettingsRow

NotificationItem

AuraMessage

AuraComposer

Keep the implementation modular so I can transplant these components into my real Nexali project later.

==================================================

START WITH TRANSACTIONS ONLY

==================================================

For the first pass, do NOT redesign the entire application.

Implement the Transactions experience first.

Use the Transactions design from the ZIP.

Create:

1. Desktop Transactions

2. iPad/tablet Transactions

3. iPhone/Android Transactions

Desktop should closely reproduce the supplied design.

Tablet should be an intentional adaptation.

Mobile should use an app-style transaction-card experience.

Include:

- Financial Activity heading

- supporting copy

- Add Transaction

- search

- filters

- transaction list/table

- pagination

- Add/Edit dialog

- delete confirmation

- realistic empty state

- realistic loading state if useful

Use mock transaction data for demonstration.

Do not build transaction backend functionality.

==================================================

FULL VIEWPORT

==================================================

Every page must maintain the dark Nexali background across the full viewport.

Never allow a white area to appear beneath short page content.

Use correct html/body/root/app min-height handling.

==================================================

ACCESSIBILITY

==================================================

Use:

- semantic elements

- accessible dialogs

- accessible sheets

- labels

- visible focus states

- aria-labels on icon buttons

- sufficient contrast

- keyboard navigation

- touch-friendly mobile controls

Do not rely exclusively on hover behavior.

==================================================

IMPORTANT OUTPUT RULE

==================================================

Do not tell me that a page has been redesigned because only the colors changed.

For a successful redesign, the actual layout/composition must visibly resemble the supplied desktop reference.

Make structural JSX/component changes when required.

==================================================

STOP AFTER TRANSACTIONS

==================================================

For this first pass, implement only:

Transactions desktop

Transactions tablet

Transactions mobile

and the shared navigation/components necessary to support those views.

Do not start Dashboard, Budgets, Reports, Aura, Profile, Account, Settings, Notifications, Landing, or Auth yet.

I want to review Transactions first.

also the brand name is Nexali the ones in the pictures are placeholders

Once I approve it, we will use that implementation quality as the standard for the rest of Nexali.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9fc46287-59d2-4cc9-babf-87637da5eaf2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
