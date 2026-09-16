import { DisplayLanguagePicker } from "@/components/DisplayLanguageProvider";
import { AppIntroduction, AppSourceFooter } from "@/components/AppIntroduction";
import { CalorieAppWorkspace } from "@/components/CalorieAppWorkspace";

export default function Home() {
  return (
    <main data-calorieapp-content className="w-full px-2 py-3 sm:px-4 sm:py-10">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-brand-secondary/10 bg-white shadow-xl">
        <div className="h-1.5 bg-gradient-to-r from-brand-primary via-brand-accent to-brand-secondary" />
        <div className="p-3 sm:p-10">
          <DisplayLanguagePicker />
          <AppIntroduction />

          <CalorieAppWorkspace />
        </div>
      </div>

      <AppSourceFooter />
    </main>
  );
}
