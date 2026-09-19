import type { Metadata } from "next";
import { CalorieStudioPage } from "@/components/CalorieStudioPage";

export const metadata: Metadata = {
  title: "CalorieStudio",
  description: "Create and discover world content inside the Calorie ecosystem.",
};

export default function StudioPage() {
  return <CalorieStudioPage />;
}
