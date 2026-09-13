import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { DashboardPreview } from "./DashboardPreview";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-28 md:pb-28 md:pt-40 xl:pb-32 xl:pt-48">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 50% 20%, color-mix(in oklab, oklch(var(--primary)) 12%, transparent) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="mx-auto max-w-[1700px] px-4 text-center md:px-8 xl:px-12">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-high px-3 py-1 lg:mb-8 lg:gap-2.5 lg:px-4 lg:py-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-success lg:h-4 lg:w-4" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground lg:text-sm">
            Clarity for every dollar
          </span>
        </div>

        <h1 className="mx-auto max-w-4xl font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-[44px] sm:leading-[1.15] md:text-[56px] lg:max-w-5xl lg:text-[72px] lg:leading-[1.05] xl:max-w-6xl xl:text-[80px] 2xl:max-w-[1400px] 2xl:text-[88px]">
          Master your money with <span className="text-primary">precision</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg lg:mt-6 lg:max-w-3xl lg:text-xl xl:mt-7 xl:text-[22px]">
          Nexali brings your transactions, budgets and reports into one clear view — and Aura,
          your built-in AI assistant, is always ready to explain where your money goes.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 lg:mt-10 lg:flex-row lg:gap-4">
          <Button
            variant="hero"
            size="lg"
            asChild
            className="w-full lg:w-auto lg:h-14 lg:px-10 lg:text-lg xl:h-16 xl:px-12 xl:text-xl"
          >
            <Link to="/signup">
              Start your journey <ArrowRight className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            variant="surface"
            size="lg"
            asChild
            className="w-full lg:w-auto lg:h-14 lg:px-10 lg:text-lg xl:h-16 xl:px-12 xl:text-xl"
          >
            <Link to="/dashboard">View demo</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-[1520px] px-4 md:px-8 lg:mt-16 xl:mt-20 xl:px-12">
        <DashboardPreview />
      </div>
    </section>
  );
}
