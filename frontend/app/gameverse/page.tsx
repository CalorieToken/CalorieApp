import type { Metadata } from "next";
import { GameverseWorld } from "@/components/GameverseWorld";

export const metadata: Metadata = {
  title: "CalorieVerse",
  description: "The living metaverse of the Calorie ecosystem.",
};

export default function GameversePage() {
  return <GameverseWorld />;
}
