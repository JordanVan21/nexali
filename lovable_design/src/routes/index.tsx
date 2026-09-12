import { createFileRoute } from "@tanstack/react-router";

import { PublicNav } from "@/components/landing/PublicNav";
import { Hero } from "@/components/landing/Hero";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { CtaBanner } from "@/components/landing/CtaBanner";
import { PublicFooter } from "@/components/landing/PublicFooter";

const title = "Nexali — Master your money with precision";
const description =
  "Nexali unifies transactions, budgets and reports into one clear dashboard, with Aura, your built-in AI assistant, to explain your spending.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PublicNav />
      <main className="pt-16 md:pt-[72px]">
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <CtaBanner />
      </main>
      <PublicFooter />
    </div>
  );
}
