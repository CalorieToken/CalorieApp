import { FoodSearchPlaceholder } from "@/components/FoodSearchPlaceholder";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen w-full py-10 px-4 sm:py-12">
      {/* Centered card container */}
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
    </main>
  );
}
