import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CtaBanner() {
  return (
    <section className="bg-surface-high">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl px-4 py-14 text-center md:px-8">
        <Wallet
          className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 text-foreground/5"
          aria-hidden="true"
        />
        <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
          Ready to take control?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Create an account, add your first budget in under five minutes, and let Aura keep
          track of the rest.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 md:flex-row">
          <Button variant="brand" size="lg" asChild className="w-full md:w-auto">
            <Link to="/signup">Create free account</Link>
          </Button>
          <Button variant="surface" size="lg" asChild className="w-full md:w-auto">
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
