You are a senior full-stack software engineer, product designer, and AI application architect responsible for auditing, repairing, completing, and preparing an unfinished personal budget tracker for production.

Use the attached `budget_tracker.zip` project as the primary source of truth. Do not create a disconnected mockup or replace the application with an unrelated project. Inspect the existing codebase before making changes, understand the current architecture, preserve useful working functionality, and improve the application directly.

The finished product must be a polished, secure, responsive personal-finance application with an embedded AI financial assistant.

# Existing Technology Stack

The current application uses:

* React 19
* TypeScript
* Vite
* Tailwind CSS
* Supabase Authentication
* Supabase PostgreSQL
* Supabase Storage
* Supabase RPC functions
* Supabase Edge Functions
* TanStack React Query
* React Router
* Recharts
* Radix UI
* Lucide icons

Preserve this stack unless a change is necessary for security, correctness, accessibility, performance, mobile compatibility, or maintainability.

Do not replace Supabase with another backend.

# Existing Application Features

The existing project already contains or partially contains:

* Landing page
* User registration
* User sign-in
* Protected application routes
* Dashboard
* Transactions
* Categories
* Budgets
* Reports
* Profile settings
* Avatar management
* Timezone preferences
* Budget-reset preferences
* Account deletion
* Desktop navigation
* Partial mobile navigation
* Dark financial-dashboard styling
* Green and blue accents
* Gradients
* Rounded cards
* Charts
* Responsive components

Review each existing feature before changing it. Reuse working code instead of unnecessarily rebuilding it.

# Primary Objective

Transform the unfinished project into a secure, polished, production-ready personal-finance application that works well on:

* Desktop browsers
* Laptop browsers
* iPhones
* Android phones
* iPads
* Android tablets
* Portrait orientation
* Landscape orientation
* Small and large screens

The finished product should work as:

1. A standard responsive web application.
2. An installable Progressive Web App.
3. A codebase prepared for packaging through Capacitor for iOS, iPadOS, and Android.

The application must also include an embedded AI financial assistant that can securely analyze the signed-in user’s financial data.

# Development Approach

Before implementing major changes:

1. Inspect the entire repository.
2. Identify what is functional.
3. Identify what is incomplete.
4. Identify what is broken.
5. Identify unnecessary duplication.
6. Identify large or difficult-to-maintain components.
7. Identify security concerns.
8. Identify accessibility concerns.
9. Identify performance problems.
10. Identify required Supabase migrations.
11. Identify unfinished routes and controls.
12. Identify features advertised but not actually implemented.
13. Identify what must be completed before mobile packaging.

Do not stop after producing an audit. Use the audit to implement the required improvements.

# Known Areas Requiring Attention

The current project may contain issues including:

* A failing production build
* TypeScript errors
* Unused imports and variables
* Broad or unnecessary `any` types
* Debugging statements
* Commented-out legacy code
* Large page components
* An unfinished Reports page
* An unfinished Settings route
* Non-persistent preference controls
* Inconsistent error states
* Inconsistent loading states
* Inconsistent empty states
* Inconsistent success feedback
* Incomplete mobile layouts
* Placeholder content
* Temporary branding
* Missing production documentation
* Missing tests
* Missing PWA configuration
* Missing mobile packaging preparation

Do not limit the audit to this list.

# Embedded AI Financial Assistant

The application must include an AI financial assistant that lives inside the budget tracker.

This assistant is a product feature for the signed-in user. It is different from development agents used to build the application.

The assistant should appear as a dedicated application destination named something such as:

* Assistant
* Budget Assistant
* Financial Assistant
* Ask Budget AI

Use a professional temporary name that can be changed easily later.

## Assistant Placement

### Desktop

Add the assistant to the authenticated desktop navigation:

* Dashboard
* Transactions
* Budgets
* Reports
* Assistant
* Settings or Profile

The Assistant page should provide a full conversational interface.

A smaller optional assistant panel may also appear on the Dashboard, but it must link to the complete Assistant experience.

### Mobile

On phones, include the Assistant in the bottom navigation or mobile navigation menu.

The Assistant should open as a full-screen mobile experience rather than a narrow desktop chat window.

### Tablet

On iPads and larger tablets, support either:

* A full Assistant page
* A split-view assistant panel
* A collapsible side panel

The interface must remain usable in both portrait and landscape orientation.

# AI Assistant: First Version

The first production version must be a read-only financial assistant.

It may analyze and explain financial information, but it must not create, edit, or delete financial records.

The first version must be able to:

## 1. Calculate Income and Expenses

The user should be able to ask questions such as:

* How much income did I receive this month?
* How much did I spend last week?
* What were my expenses between two dates?
* What was my net income in June?
* How much have I spent today?

The assistant must correctly interpret:

* Current month
* Previous month
* Current week
* Previous week
* Current year
* Previous year
* Custom date ranges
* Relative dates
* The user’s timezone

The assistant must clearly state the period it used in its answer.

## 2. Explain Budget Progress

The assistant should answer questions such as:

* How are my budgets doing?
* Which budgets am I close to exceeding?
* How much is left in my grocery budget?
* Why is my dining budget over its limit?
* Which budget has the most money remaining?

Responses should explain:

* Budgeted amount
* Amount spent
* Amount remaining
* Percentage used
* Reporting period
* Whether the budget is on track, close to its limit, or over budget

## 3. Identify Highest-Spending Categories

The assistant should be able to:

* Rank categories by spending
* Identify the highest-spending category
* Compare category spending
* Calculate the share of total expenses represented by a category
* Explain which categories contributed most to a spending increase

Example questions:

* What did I spend the most on this month?
* What are my top three expense categories?
* How much of my spending was dining?
* Which category increased the most compared with last month?

## 4. Compare Financial Periods

The assistant should compare equivalent periods, including:

* This month versus last month
* This week versus last week
* This year versus last year
* A custom range versus the previous equivalent range
* One selected month versus another selected month

Comparisons should include:

* Absolute difference
* Percentage difference when meaningful
* Major contributing categories
* Major contributing merchants
* Changes in income
* Changes in expenses
* Changes in net income

The assistant should not calculate misleading percentages when the comparison value is zero or too small. In those cases, explain the change using dollar amounts instead.

## 5. Find Unusual Spending

The assistant should identify spending that appears unusual compared with the user’s own financial history.

Possible signals include:

* A transaction significantly larger than normal
* A sudden increase in a category
* Repeated charges
* Unexpected merchant frequency
* Spending outside the user’s typical range
* A category that is rising quickly
* A budget that is being consumed unusually early
* A subscription-like payment that changed in amount

The assistant must describe unusual activity cautiously.

It must not state that a transaction is fraudulent unless the application has sufficient verified evidence.

Use wording such as:

* This transaction is larger than your usual transactions in this category.
* This category is higher than your recent average.
* You may want to review these repeated charges.
* This spending pattern appears unusual compared with previous months.

Explain the reason a transaction or pattern was flagged.

## 6. Summarize Recent Transactions

The assistant should summarize recent activity by:

* Date
* Category
* Merchant
* Income versus expense
* Total amount
* Largest transactions
* Repeated merchants
* Relevant patterns

Example questions:

* Summarize my recent transactions.
* What did I spend money on this week?
* What were my largest recent purchases?
* Did I receive any income recently?
* Show me a summary of my last ten transactions.

Do not overwhelm the user with raw database records. Provide a useful summary and allow the interface to link to the underlying transactions.

## 7. Explain Charts and Reports

The assistant should understand the data used by the Dashboard and Reports pages.

It should answer questions such as:

* What does this chart show?
* Why did expenses increase here?
* Which category caused this spike?
* What does net cash flow mean?
* Why is this month lower than last month?
* Explain my budget-versus-actual report.

Responses should reference the actual values represented in the chart or report.

Do not provide generic chart explanations when the user is asking about their personal data.

## 8. Respect Timezone and Currency Preferences

All assistant calculations and explanations must use the user’s saved:

* Timezone
* Currency
* Date format
* Number format
* Budget-reset cycle

The user’s timezone must determine:

* Transaction dates
* Start and end of day
* Weekly boundaries
* Monthly boundaries
* Reporting periods
* Relative-date interpretation

Do not rely solely on the server timezone or browser default.

Currency values should be formatted using the user’s selected currency and number preferences.

## 9. Suggest Realistic Budget Adjustments

The assistant may suggest non-binding budget adjustments based on the user’s actual spending history.

Examples:

* Your dining budget is $200, but your average over the last three months is $265. A target between $240 and $270 may be more realistic.
* Your grocery spending has remained below $300 for four months. You may be able to lower the budget slightly or move the unused amount to another category.
* Transportation spending increased recently, so reducing the budget immediately may not be realistic.

Suggestions should:

* Use actual user data
* Explain the reasoning
* Use an appropriate comparison period
* Avoid unrealistic assumptions
* Avoid shaming language
* Avoid presenting recommendations as guaranteed financial outcomes
* Avoid making changes automatically
* Clearly distinguish suggestions from completed actions

The assistant should not claim to be a licensed financial adviser.

# Read-Only Restrictions

For the first version, the AI assistant must not:

* Create a transaction
* Edit a transaction
* Delete a transaction
* Change a transaction category
* Create a budget
* Edit a budget
* Delete a budget
* Change profile settings
* Change financial targets
* Delete an account
* Export data without a direct user-controlled export action
* Execute SQL
* Select an arbitrary user ID
* Access another user’s data
* Make external purchases
* Connect bank accounts
* Transfer money
* Present itself as a licensed financial professional

If a user asks the first-version assistant to perform an unsupported action, it should explain that it can currently analyze information but cannot modify financial records.

Example:

> I can help you determine the correct amount, category, and date, but the current assistant cannot create transactions. You can add it from the Transactions page.

# Future Advanced Assistant

Design the architecture so that controlled actions can be added later without rebuilding the entire assistant.

Do not enable these actions in the first production version.

Future versions may include:

* Create a transaction
* Edit a transaction
* Categorize uncategorized transactions
* Create a budget
* Update a budget
* Delete a budget
* Change a spending target
* Generate a monthly report
* Export selected transactions

## Future Action Requirements

When action-taking capabilities are added later:

* Every action must use controlled server-side tools.
* The AI model must not execute arbitrary database operations.
* The authenticated user ID must come from the verified session.
* The model must never supply or override another user’s ID.
* All inputs must be validated server-side.
* Row Level Security must remain enabled.
* Destructive actions must require explicit confirmation.
* Financial changes must never occur silently.
* The interface must show exactly what will change.
* The user must be able to confirm or cancel.
* Completed actions must return a clear receipt or result.
* Failed actions must not leave partial changes.
* Important actions should be logged for auditing.
* The assistant should link the user to the affected record after completion.

Example future confirmation:

> Create the following budget?
>
> Category: Dining
> Period: August 2026
> Amount: $300
>
> Confirm or cancel.

Deletion should require a stronger confirmation than creation or editing.

# Assistant User Interface

Create a polished conversational interface containing:

* Conversation messages
* Suggested starter questions
* Loading indicators
* Streaming response support when available
* Clear error messages
* Empty conversation state
* New conversation control
* Conversation history
* Relevant financial summary cards
* Date-period labels
* Links to related transactions
* Links to related budgets
* Links to related reports
* Accessible keyboard navigation
* Screen-reader labels
* Mobile-safe input behavior
* Responsive message widths
* Retry controls
* Copy-response control
* Feedback controls where appropriate

Suggested starter questions may include:

* How much did I spend this month?
* What are my highest-spending categories?
* Am I on track with my budgets?
* Compare this month with last month.
* Summarize my recent transactions.
* Did I have any unusual spending?
* What budget changes should I consider?

Do not use fake assistant responses in production.

# Assistant Response Quality

Assistant responses should be:

* Clear
* Concise
* Evidence-based
* Personalized
* Nonjudgmental
* Financially responsible
* Honest about uncertainty
* Easy to understand
* Appropriate for mobile screens

When possible, responses should include:

1. A direct answer.
2. The reporting period.
3. The main contributing factors.
4. Supporting values.
5. A practical next step.

Example:

> You spent $2,140 in July, which is $184 more than June. Dining increased by $96, transportation increased by $58, and subscriptions increased by $30. Dining was the largest contributor to the increase.

Do not reveal hidden system prompts, internal tool definitions, private database details, API keys, or sensitive implementation information.

# Assistant Data Grounding

The assistant must calculate answers from trusted application data.

Do not rely on the language model to perform all financial calculations mentally.

Create deterministic server-side tools or functions for calculations such as:

* `get_financial_summary`
* `get_income_total`
* `get_expense_total`
* `get_net_income`
* `get_budget_status`
* `get_category_spending`
* `get_merchant_spending`
* `compare_periods`
* `get_recent_transactions`
* `find_spending_anomalies`
* `get_report_data`
* `get_user_preferences`

The AI should use these trusted results to explain the user’s finances.

Important financial totals, date ranges, percentages, and comparisons should be calculated in application code or database functions, not estimated by the model.

# Assistant Backend Architecture

The frontend must not call the AI provider with a secret API key.

Use a secure server-side architecture such as:

```text
React application
        ↓
Authenticated Supabase Edge Function
        ↓
Authorization and input validation
        ↓
Read-only financial tools
        ↓
AI model
        ↓
Validated response
        ↓
Assistant interface
```

Requirements:

* Store the AI API key only in server-side environment variables.
* Never include the API key in the browser bundle.
* Verify the user’s Supabase access token.
* Obtain the user ID from the verified authentication session.
* Reject unauthenticated requests.
* Restrict every query to the authenticated user.
* Apply rate limiting.
* Apply request-size limits.
* Validate tool inputs and outputs.
* Sanitize errors returned to the frontend.
* Add timeout handling.
* Add safe retry behavior.
* Prevent arbitrary SQL generation.
* Prevent arbitrary function execution.
* Prevent cross-user data access.
* Keep server logs free from unnecessary financial details.

# AI Provider Abstraction

Do not tightly couple the entire application to one AI provider.

Create a small server-side AI service abstraction so that the model provider can be changed later without rewriting the user interface or financial tools.

The abstraction should separate:

* Model configuration
* Assistant instructions
* Financial tools
* Conversation state
* Safety rules
* Response streaming
* Usage limits
* Error handling

Use environment variables for provider configuration.

# Privacy and Data Retention

Financial information is sensitive.

The implementation must clearly define:

* Whether assistant conversations are stored
* Where conversations are stored
* How long conversations are retained
* Whether users can delete conversations
* Whether conversations are included in account deletion
* Whether full financial records are sent to the AI provider
* How unnecessary data exposure is minimized

Prefer sending only the minimum information required to answer each question.

For example, if the user asks for a monthly expense total, send the calculated result and necessary supporting categories rather than the user’s complete transaction history.

Do not store full AI prompts or complete financial datasets in application logs.

# Conversation Storage

If conversations are persisted, create appropriate tables such as:

* `ai_conversations`
* `ai_messages`

Possible fields may include:

## `ai_conversations`

* `id`
* `user_id`
* `title`
* `created_at`
* `updated_at`

## `ai_messages`

* `id`
* `conversation_id`
* `user_id`
* `role`
* `content`
* `metadata`
* `created_at`

Requirements:

* Enable Row Level Security.
* Restrict records to their authenticated owner.
* Include conversations in account deletion.
* Provide a delete-conversation control.
* Avoid storing hidden reasoning or sensitive internal model data.
* Store only information needed for the user-facing conversation.
* Add retention controls if appropriate.

Create all schema changes through versioned Supabase migrations.

# AI Usage Limits

Implement reasonable protections against uncontrolled AI usage.

Include:

* Per-user rate limits
* Message-length limits
* Daily or monthly usage limits if needed
* Clear error messages when limits are reached
* Protection against repeated duplicate requests
* Server-side enforcement
* Basic usage monitoring without exposing private financial content

The application should remain usable even when the assistant is temporarily unavailable.

Core budgeting, transaction, and reporting features must not depend on the AI service.

# AI Safety and Financial Boundaries

The assistant may provide budgeting observations and general educational guidance.

It must not:

* Guarantee savings
* Guarantee investment returns
* Provide individualized investment instructions as authoritative advice
* Provide tax conclusions as professional tax advice
* Provide legal conclusions
* Encourage hiding financial information
* Shame the user
* Fabricate missing financial records
* Claim certainty when data is incomplete

When information is missing, the assistant should say what is unavailable.

Example:

> I can compare your grocery spending for the last two months, but there are no grocery transactions recorded for May, so the comparison may be incomplete.

# Core Application Requirements

## Build and Code Quality

* Make `npm run build` pass.
* Make the configured lint command pass.
* Remove unused imports and dead code.
* Remove unnecessary debugging statements.
* Replace unsafe TypeScript types.
* Avoid temporary error suppressions.
* Add meaningful error handling.
* Prevent duplicate submissions.
* Validate all forms.
* Add an `.env.example`.
* Never commit secrets.
* Keep the application runnable after each major stage.

## Architecture

Refactor oversized components into focused modules.

Use a maintainable structure such as:

* `components`
* `features`
* `hooks`
* `lib`
* `pages`
* `services`
* `types`
* `utils`
* `supabase`
* `ai`

Keep:

* Server-state logic in TanStack React Query
* Business logic separate from presentation
* Formatting logic centralized
* AI tools separate from the chat interface
* Supabase calls organized
* Query keys consistent
* Validation reusable

## Responsive Design

Use a mobile-first design.

Requirements:

* No horizontal page scrolling
* Safe-area support
* Touch-friendly controls
* Responsive charts
* Mobile-friendly transaction cards
* Desktop-friendly tables
* Mobile full-screen dialogs where appropriate
* Tablet split layouts where appropriate
* Keyboard-safe forms
* Portrait and landscape support
* Consistent responsive spacing
* Readable typography
* Accessible contrast

## Authentication

Complete:

* Sign up
* Sign in
* Sign out
* Session persistence
* Protected routes
* Email verification messaging
* Forgot password
* Reset password
* Authentication error handling
* Loading states
* Password visibility
* Safe redirects
* Expired-session handling

## Dashboard

Include:

* Current-period income
* Current-period expenses
* Net income
* Remaining budget
* Budget utilization
* Spending by category
* Recent transactions
* Budget warnings
* Trend chart
* Period selection
* Useful empty states
* Entry point to the AI assistant

## Transactions

Users must be able to:

* Add transactions
* Edit transactions
* Delete transactions
* Select categories
* Create personal categories
* Enter merchant or source
* Enter notes
* Select transaction date and time
* Search transactions
* Filter transactions
* Sort transactions
* Navigate paginated results
* Clear filters
* View mobile cards
* View desktop tables

## Categories

Users must be able to:

* View default categories
* View personal categories
* Create personal categories
* Rename personal categories
* Delete personal categories safely
* Distinguish global and personal categories
* Avoid duplicates
* Preserve existing transaction relationships

## Budgets

Users must be able to:

* Create budgets
* Edit budgets
* Delete budgets
* Select period
* View budgeted amount
* View amount spent
* View amount remaining
* View percentage used
* View warnings
* Navigate between periods
* Avoid duplicate budgets

Calculations must respect timezone and reporting period.

## Reports

Complete the Reports page with:

* Income-versus-expense trends
* Spending by category
* Net cash flow
* Budget versus actual
* Highest-spending categories
* Highest-spending merchants
* Average spending
* Period comparisons
* Date controls
* Responsive charts
* Tooltips
* Legends
* Empty states
* CSV download
* AI explanation entry points

Each major chart may include an action such as:

* Explain this chart
* Ask the Assistant
* Why did this change?

These actions should open the Assistant with relevant report context.

## Profile and Settings

Complete:

* Full name
* Email display
* Avatar
* Currency
* Date format
* Number format
* Timezone
* Budget-reset cycle
* Reset day
* Theme preference
* Password-reset access
* Sign out
* Account deletion
* AI conversation settings
* AI history deletion
* AI privacy information

Persist functional settings through Supabase migrations and profile updates.

# Supabase Security

Verify:

* Row Level Security is enabled.
* Users can access only their own records.
* Global categories are protected.
* Storage policies are secure.
* RPC functions cannot expose another user’s data.
* Edge Functions verify authentication.
* Account deletion cannot target another user.
* AI tools cannot accept arbitrary user IDs.
* AI conversation tables are user-isolated.
* No service-role credential reaches the frontend.
* Database errors do not leak sensitive details.

Use database constraints where appropriate.

# Accessibility

Include:

* Semantic HTML
* Correct heading structure
* Visible focus states
* Keyboard navigation
* Accessible dialogs
* Proper labels
* ARIA attributes
* Sufficient contrast
* Reduced-motion support
* Screen-reader-friendly feedback
* Accessible chart summaries
* Accessible AI message status
* Focus management
* Touch-friendly controls

Do not communicate financial status using color alone.

# Performance

* Debounce search.
* Use server-side pagination.
* Add appropriate database indexes.
* Avoid unnecessary re-renders.
* Lazy-load major routes.
* Limit chart dataset size.
* Avoid sending unnecessary data to the AI provider.
* Stream AI responses where supported.
* Cancel abandoned AI requests.
* Prevent duplicate AI requests.
* Keep the application responsive on lower-powered phones.

# Progressive Web App

Add:

* Web app manifest
* App icons
* Theme color
* Standalone display
* Service worker
* Installability
* Safe caching
* Offline fallback
* Update handling
* Mobile viewport settings

Do not cache sensitive AI responses or private financial data insecurely.

The core application should provide an appropriate unavailable state when offline.

Do not claim full offline AI functionality.

# Capacitor Preparation

Prepare the application for:

* iOS
* iPadOS
* Android
* Web

Include:

* Capacitor configuration
* Safe-area handling
* Status-bar configuration
* Splash screen
* App icons
* Keyboard handling
* External links
* Authentication redirects
* Back-button behavior
* Deep-link planning
* Secure session behavior
* Build documentation

# Stitch, Lovable, Claude, and Development Agent Workflow

Use the tools with separate responsibilities.

## Google Stitch

Use Stitch for:

* Design exploration
* Mobile layouts
* Tablet layouts
* Desktop layouts
* Assistant page design
* Chat message design
* Suggested-question design
* Financial summary cards
* Future confirmation-card designs
* Empty states
* Loading states
* Error states

Stitch output is a design reference, not the source of truth.

## Lovable

Use Lovable for:

* Rapid prototypes
* Testing uncertain interactions
* Experimenting with assistant layouts
* Testing mobile navigation
* Testing report interactions

Do not replace the official repository with a separate Lovable application.

Integrate only selected and reviewed ideas.

## Claude

Use Claude for:

* Large refactors
* Supabase review
* Edge Function implementation
* AI tool implementation
* Debugging
* Testing
* Code review
* Architecture analysis

## Development Agent

Use the development agent to:

* Work directly in the official repository
* Implement assigned tasks
* Edit project files
* Run build, lint, and tests
* Review external generated code
* Integrate approved designs
* Create focused branches or pull requests
* Report changed files
* Report migrations
* Report verification results

## Source of Truth

The official GitHub repository is the only source of truth.

Do not allow Stitch, Lovable, Claude, or another agent to maintain separate competing production versions.

# Testing

Add tests for:

* Authentication
* Protected routes
* Transactions
* Categories
* Budgets
* Financial calculations
* Timezone calculations
* Currency formatting
* Reports
* Profile updates
* Account deletion safeguards
* Assistant authentication
* Assistant user isolation
* Assistant date interpretation
* Assistant financial totals
* Assistant category ranking
* Assistant period comparison
* Assistant anomaly detection
* Assistant budget explanations
* Assistant unavailable states
* Assistant rate limits
* Assistant refusal to modify data
* Responsive navigation
* Mobile assistant input behavior

Use:

* Unit tests
* Integration tests
* End-to-end tests
* Manual responsive testing

Test representative sizes including:

* Small iPhone
* Standard iPhone
* Large phone
* iPad portrait
* iPad landscape
* Laptop
* Large desktop

# Implementation Order

Complete work in this sequence:

1. Audit the repository.
2. Fix build, lint, typing, and runtime errors.
3. Review and secure Supabase.
4. Refactor oversized components.
5. Complete authentication.
6. Complete navigation and responsive application shell.
7. Complete transactions and categories.
8. Correct budget calculations.
9. Complete Reports.
10. Complete Profile and Settings.
11. Improve Dashboard and Landing page.
12. Define the AI assistant architecture.
13. Build deterministic read-only financial tools.
14. Build the authenticated AI Edge Function.
15. Build the Assistant interface.
16. Add Assistant links to Dashboard and Reports.
17. Add AI privacy, rate limits, and error handling.
18. Test financial assistant accuracy and isolation.
19. Add accessibility improvements.
20. Add PWA support.
21. Add Capacitor preparation.
22. Rewrite documentation.
23. Perform a final production review.

Do not implement advanced AI write actions during the first-version assistant phase.

Prepare the architecture for them, but keep them disabled.

# Definition of Done

The project is complete when:

* The production build succeeds.
* Linting succeeds.
* Core workflows use real Supabase data.
* Authentication is reliable.
* Row Level Security protects all user data.
* No major route is empty or broken.
* Transactions work correctly.
* Categories work correctly.
* Budgets work correctly.
* Reports provide meaningful analysis.
* Preferences persist.
* Timezone and currency formatting are correct.
* The interface works on desktop, iPhone, iPad, and Android layouts.
* The AI assistant exists inside the application.
* The AI assistant can calculate income and expenses.
* The AI assistant can explain budgets.
* The AI assistant can rank spending categories.
* The AI assistant can compare periods.
* The AI assistant can identify unusual spending cautiously.
* The AI assistant can summarize recent transactions.
* The AI assistant can explain charts and reports.
* The AI assistant respects timezone and currency settings.
* The AI assistant can suggest realistic budget adjustments.
* The first-version assistant cannot modify financial records.
* AI requests are authenticated.
* AI data is isolated by user.
* AI provider keys remain server-side.
* Important financial calculations are deterministic.
* Conversations can be managed securely.
* The application remains functional when the AI service is unavailable.
* The app is installable as a PWA.
* The project is prepared for Capacitor.
* Documentation explains setup, deployment, AI configuration, testing, and mobile packaging.
* No secrets, debugging output, personal placeholders, or unfinished production-facing features remain.

# Final Delivery Report

At completion, provide:

1. Problems discovered.
2. Features completed.
3. AI assistant architecture.
4. AI tools implemented.
5. Files changed.
6. Components added or refactored.
7. Supabase migrations added.
8. Edge Functions added.
9. Security improvements.
10. Privacy and data-retention behavior.
11. Tests added.
12. Commands executed.
13. Build and lint results.
14. Remaining limitations.
15. Features intentionally deferred.
16. Exact instructions for running:

* Web development
* Production web build
* Supabase locally
* AI assistant locally
* PWA
* iOS
* Android

Do not stop after providing recommendations when implementation is possible. Complete the assigned work, verify it, and clearly document the result.
