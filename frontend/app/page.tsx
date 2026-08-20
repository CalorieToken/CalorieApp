import { FoodSearchPlaceholder } from "@/components/FoodSearchPlaceholder";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen w-full py-10 px-4 sm:py-12">
      {/* Centered app container */}
      <div className="mx-auto w-full max-w-2xl rounded-3xl bg-white shadow-lg p-8 sm:p-10">
        {/* Header with logo and app name */}
        <div className="flex items-center gap-3 mb-8">
          <Image
            src="/logo.png"
            alt="CalorieApp Logo"
            className="w-10 h-10 sm:w-12 sm:h-12"
            width={48}
            height={48}
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-primary">
              CalorieApp
            </h1>
            <p className="text-xs sm:text-sm text-brand-secondary font-medium">
              Nutrition Tracking
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="mt-8">
          <FoodSearchPlaceholder />
        </div>
      </div>

      {/* Branding and attribution */}
      <section className="mx-auto mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-2" aria-label="Branding and data attribution">
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="CalorieApp logo"
              className="h-10 w-10 sm:h-11 sm:w-11"
              width={44}
              height={44}
            />
            <p className="text-sm font-semibold text-brand-primary">CalorieApp</p>
          </div>
          <p className="mt-3 text-xs text-brand-secondary/80">
            Track your food. Understand your nutrition.
          </p>
        </div>

        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-brand-secondary/25 bg-brand-bg text-[10px] font-semibold text-brand-secondary sm:h-11 sm:w-11">
              OFF
            </div>
            <p className="text-sm font-semibold text-brand-primary">Open Food Facts</p>
          </div>
          <p className="mt-3 text-xs text-brand-secondary/80">
            Food data provided by{" "}
            <a
              href="https://world.openfoodfacts.org"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-secondary hover:underline"
            >
              Open Food Facts
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
