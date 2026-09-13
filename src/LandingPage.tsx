import { PublicHeader } from "./components/auth/PublicHeader";
import { Hero } from "./components/landing/Hero";
import { FeatureGrid } from "./components/landing/FeatureGrid";
import { HowItWorks } from "./components/landing/HowItWorks";
import { CtaBanner } from "./components/landing/CtaBanner";
import { PublicFooter } from "./components/landing/PublicFooter";

const LandingPage = () => {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PublicHeader />
      <main className="pt-16 md:pt-[72px] xl:pt-20">
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <CtaBanner />
      </main>
      <PublicFooter />
    </div>
  );
};

export default LandingPage;
