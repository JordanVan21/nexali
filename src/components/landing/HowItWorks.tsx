import { landingSteps } from "../../lib/landingContent";

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-outline-variant bg-surface-low py-16 md:py-20 xl:py-24">
      <div className="mx-auto max-w-[1700px] px-4 md:px-8 xl:px-12">
        <div className="mx-auto max-w-2xl text-center lg:max-w-3xl">
          <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl xl:text-[48px]">
            How Nexali works
          </h2>
          <p className="mt-3 text-base text-muted-foreground lg:mt-4 lg:text-lg xl:text-xl">
            Three steps from raw account activity to a plan you can actually follow.
          </p>
        </div>

        <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 lg:mt-12 lg:gap-6 xl:mt-14">
          {landingSteps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-outline-variant bg-card p-5 lg:p-6 xl:p-7">
              <span className="numeric grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-sm font-semibold text-primary xl:h-10 xl:w-10 xl:text-base">
                {index + 1}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground xl:text-xl">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground lg:text-base xl:text-[17px]">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
