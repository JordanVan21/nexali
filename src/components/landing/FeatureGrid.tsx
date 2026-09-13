import { BarChart3, ListChecks, Sparkles, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { landingFeatures } from "../../lib/landingContent";

const iconMap: Record<string, LucideIcon> = {
  transactions: ListChecks,
  aura: Sparkles,
  budgets: Wallet,
  reports: BarChart3,
};

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-[1700px] px-4 py-16 md:px-8 md:py-24 xl:px-12 xl:py-28">
      <div className="mx-auto max-w-2xl text-center lg:max-w-3xl">
        <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl xl:text-[48px]">
          Engineered for everyday financial clarity
        </h2>
        <p className="mt-3 text-base text-muted-foreground lg:mt-4 lg:text-lg xl:text-xl">
          Every tool you need to understand and control your money, in one calm dashboard.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4 lg:gap-6 xl:mt-14">
        {landingFeatures.map((feature) => {
          const Icon = iconMap[feature.icon] ?? Sparkles;
          return (
            <div
              key={feature.title}
              id={feature.icon === "aura" ? "aura" : undefined}
              className="rounded-2xl border border-outline-variant bg-card p-5 lg:p-6 xl:p-7"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary xl:h-12 xl:w-12">
                <Icon className="h-5 w-5 xl:h-6 xl:w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground xl:text-xl">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground lg:text-base xl:text-[17px]">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
