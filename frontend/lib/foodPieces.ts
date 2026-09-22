import type { FoodSearchItem } from "@/components/foodTypes";
import { edibleGrams } from "@/lib/foodDiscovery";

export type PieceAmount = { eaten: string; total: string; weight: string; basis: "pack" | "piece" };
export const emptyPieceAmount: PieceAmount = { eaten: "", total: "", weight: "", basis: "pack" };
export function canCountPieces(food: FoodSearchItem) {
  return Boolean(food.barcode) && food.serving_size === "100 g / 100 ml (source reference)";
}
export function piecePortion(food: FoodSearchItem, amount: PieceAmount, locale: string): FoodSearchItem | null {
  if (!canCountPieces(food)) return null;
  const eaten = edibleGrams(amount.eaten, locale), weight = edibleGrams(amount.weight, locale);
  const total = amount.basis === "pack" ? edibleGrams(amount.total, locale) : null;
  if (eaten === null || weight === null || eaten > 1000 ||
      (amount.basis === "pack" && (total === null || !Number.isInteger(total) || total > 1000 || eaten > total))) return null;
  const grams = amount.basis === "pack" ? eaten / total! * weight : eaten * weight;
  if (!Number.isFinite(grams) || grams < 0.1 || grams > 5000) return null;
  const nl = locale.startsWith("nl"), format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return { ...food,
    calories: food.calories * grams / 100, protein: food.protein * grams / 100,
    fat: food.fat * grams / 100, carbohydrates: food.carbohydrates * grams / 100,
    // 100% of this explicitly calculated serving, not a percentage of 100 g.
    portion_percentage: 100,
    serving_size: `${format.format(eaten)} ${nl ? "stuks" : "pieces"}${total ? ` / ${format.format(total)}` : ""} · ${format.format(grams)} g (${nl ? "zelf ingevuld" : "entered manually"})`,
  };
}
