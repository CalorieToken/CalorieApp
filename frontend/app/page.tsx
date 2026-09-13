import { FoodSearchPlaceholder } from "@/components/FoodSearchPlaceholder";
import { UsdaReferenceFoods } from "@/components/UsdaReferenceFoods";
import { XamanLoginPanel } from "@/components/XamanLoginPanel";
import { DisplayLanguagePicker } from "@/components/DisplayLanguageProvider";
import { AppIntroduction, AppSourceFooter } from "@/components/AppIntroduction";
import { TestnetEntry } from "@/components/TestnetEntry";

export default function Home() {
  return (
    <main data-calorieapp-content className="w-full px-2 py-3 sm:px-4 sm:py-10">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-brand-secondary/10 bg-white shadow-xl">
        <div className="h-1.5 bg-gradient-to-r from-brand-primary via-brand-accent to-brand-secondary" />
        <div className="p-3 sm:p-10">
          <DisplayLanguagePicker />
          <AppIntroduction />

          <div>
            <XamanLoginPanel />
            <TestnetEntry />
          </div>

          <div className="mt-6">
            <FoodSearchPlaceholder />
          </div>
          <UsdaReferenceFoods />
        </div>
      </div>

      <AppSourceFooter />
    </main>
  );
}
