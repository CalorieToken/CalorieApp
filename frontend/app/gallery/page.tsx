import type { Metadata } from "next";
import { CalorieStudioPage } from "@/components/CalorieStudioPage";

export const metadata: Metadata = {
  title: "CalorieStudio",
  description: "Compatibility route for CalorieStudio.",
};

export default function GalleryCompatibilityPage() {
  return <CalorieStudioPage />;
}
