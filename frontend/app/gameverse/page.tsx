import type { Metadata } from "next";
import { GameverseWorld } from "@/components/GameverseWorld";

export const metadata: Metadata = {
  title: "Calorie Gameverse",
  description: "A first playable Calorie ecosystem world.",
};

export default function GameversePage() {
  return <GameverseWorld />;
}
