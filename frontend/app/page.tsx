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
        className="mx-auto mt-5 flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-brand-secondary/15 bg-white/95 px-5 py-4 text-xs text-brand-secondary/80 shadow-sm sm:flex-row sm:items-center sm:justify-between"
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
      </footer>
    </main>
  );
}
