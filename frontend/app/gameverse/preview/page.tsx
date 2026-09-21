import type { Metadata } from "next";
import { CalorieVerseMeadow } from "@/components/CalorieVerseMeadow";

export const metadata: Metadata = {
  title: "CalorieVerse — meadow preview",
  description: "Explore the meadow and try a small food-data activity.",
  robots: { index: false, follow: false },
};

export default function MeadowPreviewPage() {
  return <CalorieVerseMeadow />;
}
