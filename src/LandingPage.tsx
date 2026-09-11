import { Link } from "react-router-dom";
import { ArrowRight, PieChart, PiggyBank, Sparkles, Landmark } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { PublicHeader } from "./components/auth/PublicHeader";

const FEATURES = [
  {
    icon: PieChart,
    title: "Transactions & Categories",
    description:
      "Log income and expenses, organize them into categories, and search or filter your history in seconds.",
  },
  {
    icon: PiggyBank,
    title: "Budgets That Track Themselves",
    description:
      "Set a monthly budget per category and see what's spent, what's left, and when you're close to a limit.",
  },
  {
    icon: Sparkles,
    title: "Aura, Your Financial Assistant",
    description:
      "Ask Aura about your spending and budgets in plain language. Aura answers questions, it doesn't move money or change your data on its own.",
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-hero text-foreground">
      <PublicHeader />

      <div className="relative">
        <div className="relative z-10 container mx-auto px-6 pb-24 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in">
              <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  Take control
                </span>{" "}
                of your finances
              </h1>
            </div>

            <div className="animate-fade-in">
              <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Nexali is a personal budget tracker. Track every transaction, set budgets by
                category, and see where your money goes, with Aura on hand to answer questions
                about it.
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
        </div>
      </div>

      <div className="container mx-auto px-6 py-20">
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
              <feature.icon className="mb-4 h-8 w-8 text-primary" aria-hidden="true" />
              <h3 className="mb-3 text-xl font-semibold text-card-foreground">{feature.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-6 pb-24">
        <div className="rounded-3xl border border-border/50 bg-gradient-card p-12 text-center">
          <Landmark className="mx-auto mb-6 h-14 w-14 text-primary" aria-hidden="true" />
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
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Landmark className="h-4 w-4 text-primary" aria-hidden="true" />
            Nexali
          </div>
          <p>&copy; {new Date().getFullYear()} Nexali. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
