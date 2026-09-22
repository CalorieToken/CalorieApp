"use client";

import { FoodPropertyIcon } from "@/components/FoodPropertyIcon";

import { useMemo, useState } from "react";
import type { FoodSearchItem } from "@/components/foodTypes";
import { alternativeSearchQuery, betterRecordedGrade, discoveryCopy, packagedAlternatives, plantAlternativeQuery, recordedFoodLabels, foodSourceUrl } from "@/lib/foodDiscovery";

export function SimilarFoods({ item, foods, locale, disabled, canChoose = true, onChoose, onSearch }: {
  item: FoodSearchItem; foods: FoodSearchItem[]; locale: string; disabled: boolean;
  canChoose?: boolean;
  onChoose: (item: FoodSearchItem) => void; onSearch: (query: string) => void;
}) {
  const copy = discoveryCopy(locale);
  const [preference, setPreference] = useState("all");
  const similar = useMemo(() => packagedAlternatives(item, foods, preference === "all" ? 4 : foods.length)
    .filter(food => preference === "all" || recordedFoodLabels(food, locale).some(label => label.scope === preference)).slice(0, 4), [item, foods, preference, locale]);
  const family = alternativeSearchQuery(item);
  const plantQuery = plantAlternativeQuery(item, locale);
  return <details className="mt-4 rounded-xl border border-brand-secondary/20 bg-brand-bg p-3">
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-secondary focus-visible:ring-2 focus-visible:ring-brand-primary">{copy.alternatives}</summary>
    <p className="mt-2 text-sm font-semibold text-brand-primary">{copy.similarTo.replace("{food}", item.product_name)}</p>
    <p className="mt-2 text-xs leading-relaxed text-brand-secondary">{copy.suggestionNote}</p>
    <p className="mt-2 text-sm leading-relaxed text-brand-secondary">{copy.gradeNote}</p>
    <div className="mt-3 flex flex-wrap gap-2">{([["all", copy.allAlternatives], ["organic", copy.organicLabel], ["welfare", copy.welfareLabel]] as const).map(([value, label]) =>
      <button type="button" key={value} aria-pressed={preference === value} onClick={() => setPreference(value)} className={`min-h-11 rounded-full border px-3 py-2 text-xs font-semibold ${preference === value ? "border-brand-secondary bg-brand-secondary text-white" : "border-brand-secondary/30 text-brand-secondary"}`}>{label}</button>)}</div>
    {similar.length ? <ul className="mt-3 space-y-2">{similar.map(food => {
      const grade = betterRecordedGrade(item, food);
      return <li key={food.barcode || `${food.product_name}|${food.brand || ""}`} className="rounded-lg border border-brand-secondary/15 bg-white p-3">
      <p className="break-words font-semibold text-brand-primary"><bdi>{food.product_name}</bdi></p>
      {food.brand ? <p className="mt-1 break-words text-xs text-brand-secondary"><bdi>{food.brand}</bdi></p> : null}
      <p className="mt-1 text-xs text-brand-secondary"><bdi>Open Food Facts</bdi></p>
      {recordedFoodLabels(food, locale).length ? <p className="mt-2 text-xs text-brand-secondary"><bdi>{recordedFoodLabels(food, locale).map(label => label.name).join(" · ")}</bdi></p> : null}
      {foodSourceUrl(food) ? <a className="inline-flex min-h-11 items-center text-xs text-brand-secondary underline" href={foodSourceUrl(food)!} target="_blank" rel="noopener noreferrer">{copy.productSource}</a> : null}
      {grade ? <p className="mt-2 rounded-lg bg-brand-primary/5 p-2 text-sm font-semibold text-brand-primary"><FoodPropertyIcon kind="score" /> {copy.betterGrade.replace("{to}", grade.to).replace("{from}", grade.from)}</p> : null}
      {canChoose ? <button type="button" disabled={disabled} onClick={() => onChoose(food)} className="mt-2 min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 text-sm font-semibold text-brand-secondary disabled:opacity-50">{copy.choose}</button> : null}
    </li>; })}</ul> : <p role="status" className="mt-3 text-sm text-brand-secondary">{preference === "all" ? copy.noSimilar : copy.noLabelAlternative}</p>}
    {preference !== "all" || similar.some(food => recordedFoodLabels(food, locale).length) ? <p className="mt-2 text-xs leading-relaxed text-brand-secondary">{copy.labelsNote}</p> : null}
    {family ? <button type="button" disabled={disabled} onClick={() => onSearch(family)} className="mt-3 min-h-11 rounded-full border-2 border-brand-secondary bg-white px-4 py-2 text-sm font-semibold text-brand-secondary focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50">{copy.otherBrands.replace("{food}", family)}</button> : null}
    {plantQuery ? <div className="mt-3 border-t border-brand-secondary/15 pt-3">
      <button type="button" disabled={disabled} onClick={() => onSearch(plantQuery)} className="min-h-11 rounded-full border-2 border-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary focus-visible:ring-2 focus-visible:ring-brand-secondary disabled:opacity-50"><FoodPropertyIcon kind="plant" /> {copy.plantOptions}: <bdi>{plantQuery}</bdi></button>
      <p className="mt-2 text-xs leading-relaxed text-brand-secondary">{copy.plantNote}</p>
    </div> : null}
  </details>;
}
