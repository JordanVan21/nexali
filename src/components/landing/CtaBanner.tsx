import { Link } from "react-router-dom";
import { Button } from "../ui/button";

export function CtaBanner() {
  return (
    <section className="bg-surface-high">
      <div className="mx-auto max-w-[1520px] rounded-2xl px-4 py-14 text-center md:px-8 md:py-16 xl:px-12 xl:py-20">
        <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl xl:text-[48px]">
          Ready to take control?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground lg:mt-4 lg:max-w-2xl lg:text-lg xl:text-xl">
          Create an account, add your first budget in under five minutes, and let Aura keep track
          of the rest.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 lg:mt-10 lg:flex-row lg:gap-4">
          <Button
            variant="hero"
            size="lg"
            asChild
            className="w-full lg:w-auto lg:h-14 lg:px-10 lg:text-lg xl:h-16 xl:px-12 xl:text-xl"
          >
            <Link to="/signup">Create free account</Link>
          </Button>
          <Button
            variant="surface"
            size="lg"
            asChild
            className="w-full lg:w-auto lg:h-14 lg:px-10 lg:text-lg xl:h-16 xl:px-12 xl:text-xl"
          >
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground xl:mt-5 xl:text-sm">
          No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
