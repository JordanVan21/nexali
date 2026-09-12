import { BarChart3, ListChecks, Sparkles, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { landingFeatures } from "@/mock/landing";

const iconMap: Record<string, LucideIcon> = {
  transactions: ListChecks,
  aura: Sparkles,
  budgets: Wallet,
  reports: BarChart3,
};

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
          Engineered for everyday financial clarity
        </h2>
        <p className="mt-3 text-muted-foreground">
          Every tool you need to understand and control your money, in one calm dashboard.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {landingFeatures.map((feature) => {
          const Icon = iconMap[feature.icon] ?? Sparkles;
          return (
            <div
              key={feature.title}
              id={feature.icon === "aura" ? "aura" : undefined}
              className="rounded-2xl border border-outline-variant bg-card p-5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
