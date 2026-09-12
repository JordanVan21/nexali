import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardPreview } from "@/components/landing/DashboardPreview";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-28 md:pb-28 md:pt-40">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 50% 20%, color-mix(in oklab, var(--primary) 12%, transparent) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="mx-auto max-w-6xl px-4 text-center md:px-8">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-high px-3 py-1">
          <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Clarity for every dollar
          </span>
        </div>

        <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl md:leading-[1.1]">
          Master your money with <span className="text-primary">precision</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          Nexali brings your transactions, budgets and reports into one clear view — and Aura,
          your built-in AI assistant, is always ready to explain where your money goes.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 md:flex-row">
          <Button variant="brand" size="lg" asChild className="w-full md:w-auto">
            <Link to="/signup">
              Start your journey <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="surface" size="lg" asChild className="w-full md:w-auto">
            <Link to="/dashboard">View demo</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-5xl px-4 md:px-8">
        <DashboardPreview />
      </div>
    </section>
  );
}
