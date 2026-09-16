"use client";

import { useMemo } from "react";
import type { FoodSearchItem } from "@/components/foodTypes";
import { discoveryCopy, foodFamily, similarFoodNames } from "@/lib/foodDiscovery";

export function SimilarFoods({ item, foods, locale, disabled, canChoose = true, onChoose, onSearch }: {
  item: FoodSearchItem; foods: FoodSearchItem[]; locale: string; disabled: boolean;
  canChoose?: boolean;
  onChoose: (item: FoodSearchItem) => void; onSearch: (query: string) => void;
}) {
  const copy = discoveryCopy(locale);
  const similar = useMemo(() => similarFoodNames(item, foods, food => food.product_name, food => food.barcode || `${food.product_name}|${food.brand || ""}`), [item, foods]);
  const family = foodFamily(item.product_name) || item.product_name.trim();
  return <details className="mt-4 rounded-xl border border-brand-secondary/20 bg-brand-bg p-3">
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-secondary focus-visible:ring-2 focus-visible:ring-brand-primary">{copy.alternatives}</summary>
    <p className="mt-2 text-sm font-semibold text-brand-primary">{copy.similarTo.replace("{food}", item.product_name)}</p>
    <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.suggestionNote}</p>
    {similar.length ? <ul className="mt-3 space-y-2">{similar.map(food => <li key={food.barcode || `${food.product_name}|${food.brand || ""}`} className="rounded-lg border border-brand-secondary/15 bg-white p-3">
      <p className="break-words font-semibold text-brand-primary"><bdi>{food.product_name}</bdi></p>
      {food.brand ? <p className="mt-1 break-words text-xs text-brand-secondary"><bdi>{food.brand}</bdi></p> : null}
      <p className="mt-1 text-xs text-brand-secondary"><bdi>Open Food Facts</bdi></p>
      {canChoose ? <button type="button" disabled={disabled} onClick={() => onChoose(food)} className="mt-2 min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 text-sm font-semibold text-brand-secondary disabled:opacity-50">{copy.choose}</button> : null}
    </li>)}</ul> : <p className="mt-3 text-sm text-brand-secondary">{copy.noSimilar}</p>}
    {family ? <button type="button" disabled={disabled} onClick={() => onSearch(family)} className="mt-3 min-h-11 rounded-full border-2 border-brand-secondary bg-white px-4 py-2 text-sm font-semibold text-brand-secondary disabled:opacity-50">{copy.searchMore.replace("{food}", family)}</button> : null}
  </details>;
}
