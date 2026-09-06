import { FoodSearchPlaceholder } from "@/components/FoodSearchPlaceholder";
import { XamanLoginPanel } from "@/components/XamanLoginPanel";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen w-full px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-brand-secondary/10 bg-white shadow-xl">
        <div className="h-1.5 bg-gradient-to-r from-brand-primary via-brand-accent to-brand-secondary" />
        <div className="p-6 sm:p-10">
          <div className="mb-7 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-secondary/10 bg-white shadow-sm sm:h-16 sm:w-16">
              <Image
                src="/logo.png"
                alt="CalorieApp Logo"
                className="h-full w-full scale-[1.55] object-contain"
                width={64}
                height={64}
                priority
              />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-secondary/70">
                Food &amp; nutrition showcase
              </p>
              <h1 className="mt-1 text-2xl font-bold text-brand-primary sm:text-3xl">
                CalorieApp
              </h1>
              <p className="mt-1 text-sm font-medium text-brand-secondary">
                Search products. Understand nutrition. Build your food log.
              </p>
            </div>
          </div>

          <div>
            <XamanLoginPanel />
          </div>

          <div className="mt-6">
            <FoodSearchPlaceholder />
          </div>
        </div>
      </div>

      <footer
        className="mx-auto mt-5 flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-brand-secondary/15 bg-white/95 px-5 py-4 text-xs leading-relaxed text-brand-secondary/80 shadow-sm"
        aria-label="Product scope and data attribution"
      >
        <p className="font-semibold text-brand-primary">
          CalorieApp · Non-financial food and nutrition tracking
        </p>
        <p>
          Food data provided by{" "}
          <a
            href="https://world.openfoodfacts.org"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-secondary hover:underline"
          >
            Open Food Facts
          </a>{" "}
          under the{" "}
          <a
            href="https://opendatacommons.org/licenses/odbl/1-0/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-secondary hover:underline"
          >
            ODbL
          </a>
        </p>
        <div className="mt-2 flex flex-col gap-2 border-t border-brand-secondary/10 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <p>
            Thank you to the Open Food Facts community for making open food data
            available. Want to help? Contributions are always voluntary.
          </p>
          <a
            href="https://connect.openfoodfacts.org/join-the-contributor-skill-pool-open-food-facts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 self-start rounded-lg px-2 py-2 font-semibold text-brand-primary underline decoration-brand-primary/30 underline-offset-4 transition hover:decoration-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary sm:self-auto"
          >
            Contribute to Open Food Facts <span aria-hidden="true">↗</span>
          </a>
        </div>
      </footer>
    </main>
  );
}
