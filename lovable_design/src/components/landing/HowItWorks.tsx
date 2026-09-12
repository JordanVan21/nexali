import { landingSteps } from "@/mock/landing";

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-outline-variant bg-surface-low py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
            How Nexali works
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three steps from raw account activity to a plan you can actually follow.
          </p>
        </div>

        <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {landingSteps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-outline-variant bg-card p-5"
            >
              <span className="numeric grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
