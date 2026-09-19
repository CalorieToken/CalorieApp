import type { Metadata } from "next";
import { CalorieVerseMeadow } from "@/components/CalorieVerseMeadow";

export const metadata: Metadata = {
  title: "CalorieVerse",
  description: "Explore the first little meadow of CalorieVerse. One world, growing together.",
};

export default function CalorieVersePage() {
  return <CalorieVerseMeadow />;
}
