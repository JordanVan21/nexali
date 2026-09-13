import { Link } from "react-router-dom";
import { ArrowRight, PieChart, PiggyBank, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { PublicHeader } from "./components/auth/PublicHeader";
import { BrandMark } from "./components/BrandMark";
import { getCategoryIcon } from "./lib/categoryIcon";
import { cn } from "./lib/utils";
import { CONTENT_MAX_WIDTH_CLASS, CONTENT_PADDING_CLASS } from "./components/shell/containerWidth";

// Illustrative example rows for the hero preview card. Both Transactions and
// Budgets are real, shipped features; this is a mockup of their UI, not a
// claim about live or connected data.
const PREVIEW_TRANSACTIONS = [
  { category: "Groceries", label: "Whole Foods Market", meta: "Today", amount: "-$84.20", positive: false },
  { category: "Income", label: "Paycheck Deposit", meta: "Yesterday", amount: "+$4,200.00", positive: true },
  { category: "Transport", label: "Tesla Supercharger", meta: "Dec 22", amount: "-$18.50", positive: false },
];

const PREVIEW_BUDGETS = [
  { label: "Housing Budget", spent: 2100, total: 2500, barClass: "bg-primary" },
  { label: "Savings Goal", spent: 12450, total: 15000, barClass: "bg-success" },
];

const FEATURES = [
  {
    icon: PieChart,
    title: "Transactions & Categories",
    description:
      "Log income and expenses, organize them into categories, and search or filter your history in seconds.",
    chip: "bg-primary/15 text-primary",
  },
  {
    icon: PiggyBank,
    title: "Budgets That Track Themselves",
    description:
      "Set a monthly budget per category and see what's spent, what's left, and when you're close to a limit.",
    chip: "bg-success/15 text-success",
  },
  {
    icon: Sparkles,
    title: "Aura, Your Financial Assistant",
    description:
      "Ask Aura about your spending and budgets in plain language. Aura answers questions, it doesn't move money or change your data on its own.",
    chip: "bg-secondary text-secondary-foreground",
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-hero text-foreground">
      <PublicHeader />

      <div className="relative">
        <div className={cn("relative z-10 mx-auto pb-16 pt-20 sm:pt-28", CONTENT_MAX_WIDTH_CLASS, CONTENT_PADDING_CLASS)}>
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Personal finance, simplified
            </div>

            <div className="animate-fade-in">
              <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
                Take Control of Your Money
                <br />
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  with Precision
                </span>
              </h1>
            </div>

            <div className="animate-fade-in">
              <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Track every transaction, set budgets by category, and see where your money goes,
                with Aura on hand to answer questions about it.
              </p>
            </div>

            <div className="animate-fade-in flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="hero" size="lg" className="rounded-2xl px-10 text-base">
                <Link to="/signup">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-2xl px-10 text-base">
                <Link to="/signin">Sign In</Link>
              </Button>
            </div>
          </div>

          {/* Illustrative preview of the real Transactions and Budgets UI. */}
          <div className="animate-fade-in mx-auto mt-16 grid max-w-6xl gap-4 text-left sm:grid-cols-2">
            <Card className="border-border/50 bg-gradient-card p-6">
              <h3 className="mb-4 font-semibold text-card-foreground">Recent Activity</h3>
              <ul className="space-y-4">
                {PREVIEW_TRANSACTIONS.map((tx) => {
                  const Icon = getCategoryIcon(tx.category);
                  return (
                    <li key={tx.label} className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-foreground/80"
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{tx.label}</p>
                        <p className="text-xs text-muted-foreground">{tx.meta}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold [font-variant-numeric:tabular-nums]",
                          tx.positive ? "text-success" : "text-foreground"
                        )}
                      >
                        {tx.amount}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <div className="space-y-4">
              {PREVIEW_BUDGETS.map((budget) => (
                <Card key={budget.label} className="border-border/50 bg-gradient-card p-6">
                  <p className="text-sm text-muted-foreground">{budget.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    ${budget.spent.toLocaleString()}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      of ${budget.total.toLocaleString()}
                    </span>
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", budget.barClass)}
                      style={{ width: `${Math.min((budget.spent / budget.total) * 100, 100)}%` }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={cn("mx-auto py-20", CONTENT_MAX_WIDTH_CLASS, CONTENT_PADDING_CLASS)}>
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Everything you need to budget well</h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Simple, focused tools for managing your personal finances.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card
              key={feature.title}
              className="border-border/50 bg-gradient-card p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-card"
            >
              <div className={cn("mb-4 flex h-11 w-11 items-center justify-center rounded-lg", feature.chip)}>
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-card-foreground">{feature.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className={cn("mx-auto pb-24", CONTENT_MAX_WIDTH_CLASS, CONTENT_PADDING_CLASS)}>
        <div className="mx-auto max-w-4xl rounded-3xl border border-border/50 bg-gradient-card p-12 text-center">
          <div className="mb-6 flex justify-center">
            <BrandMark size="lg" />
          </div>
          <h3 className="mb-4 text-3xl font-bold">Ready to start budgeting?</h3>
          <p className="mx-auto mb-8 max-w-lg text-muted-foreground">
            Create a free Nexali account and start tracking your spending today.
          </p>
          <Button asChild variant="hero" size="lg" className="rounded-2xl px-10">
            <Link to="/signup">
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <footer className="border-t border-border/50 py-8">
        <div
          className={cn(
            "mx-auto flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row",
            CONTENT_MAX_WIDTH_CLASS,
            CONTENT_PADDING_CLASS
          )}
        >
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <BrandMark size="sm" />
            Nexali
          </div>
          <p>&copy; {new Date().getFullYear()} Nexali. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
