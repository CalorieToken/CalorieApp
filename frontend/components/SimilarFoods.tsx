"use client";

import { FoodPropertyIcon } from "@/components/FoodPropertyIcon";
import { FoodImage } from "@/components/FoodImage";
import { foodExperience } from "@/lib/foodExperience";

import { useMemo, useState } from "react";
import type { FoodSearchItem } from "@/components/foodTypes";
import { alternativeSearchQuery, normalizeFoodText, betterRecordedGrade, discoveryCopy, packagedAlternatives, plantAlternativeQuery, recordedFoodLabels, foodSourceUrl } from "@/lib/foodDiscovery";

export function SimilarFoods({ item, foods, locale, disabled, canChoose = true, onChoose, onSearch, embedded = false }: {
  item: FoodSearchItem; foods: FoodSearchItem[]; locale: string; disabled: boolean;
  canChoose?: boolean;
  embedded?: boolean;
  onChoose: (item: FoodSearchItem) => void; onSearch: (query: string) => void;
}) {
  const copy = discoveryCopy(locale);
  const [preference, setPreference] = useState("all");
  const [page, setPage] = useState(0);
  const similar = useMemo(() => packagedAlternatives(item, foods, foods.length)
    .filter(food => preference === "all" || (preference === "brand" ? Boolean(food.brand && item.brand) && normalizeFoodText(food.brand!) !== normalizeFoodText(item.brand!) : preference === "grade" ? Boolean(betterRecordedGrade(item, food)) : recordedFoodLabels(food, locale).some(label => label.scope === preference))), [item, foods, preference, locale]);
  const family = alternativeSearchQuery(item);
  const plantQuery = plantAlternativeQuery(item, locale);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(similar.length / 2) - 1));
  const content = <>
    <p className="mt-2 text-sm font-semibold text-brand-primary">{copy.similarTo.replace("{food}", item.product_name)}</p>
    <label className="mt-3 block text-xs font-semibold text-brand-secondary">{copy.filterAlternatives}
      <select value={preference} onChange={event => { setPreference(event.target.value); setPage(0); }} className="mt-1 min-h-11 w-full rounded-lg border border-brand-secondary/30 bg-white px-3 text-sm">
        {([["all", copy.allAlternatives], ["brand", copy.differentBrand], ["grade", copy.recordedBetterGrade], ["organic", copy.organicLabel], ["welfare", copy.welfareLabel]] as const).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {similar.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{similar.slice(currentPage * 2, currentPage * 2 + 2).map(food => {
      const grade = betterRecordedGrade(item, food);
      return <li key={food.barcode || `${food.product_name}|${food.brand || ""}`} className="rounded-lg border border-brand-secondary/15 bg-white p-3">
      <div className="flex items-center gap-2"><FoodImage item={food} size={96} className="h-12 w-12 shrink-0" />
      <p className="break-words text-sm font-semibold text-brand-primary"><bdi>{food.product_name}</bdi></p></div>
      {food.brand ? <p className="mt-1 break-words text-xs text-brand-secondary"><bdi>{food.brand}</bdi></p> : null}
      <p className="mt-1 text-xs text-brand-secondary"><bdi>Open Food Facts</bdi></p>
      {recordedFoodLabels(food, locale).length ? <p className="mt-2 text-xs text-brand-secondary"><bdi>{recordedFoodLabels(food, locale).map(label => label.name).join(" · ")}</bdi></p> : null}
      {foodSourceUrl(food) ? <a className="inline-flex min-h-11 items-center text-xs text-brand-secondary underline" href={foodSourceUrl(food)!} target="_blank" rel="noopener noreferrer">{copy.productSource}</a> : null}
      {grade ? <p className="mt-2 rounded-lg bg-brand-primary/5 p-2 text-sm font-semibold text-brand-primary"><FoodPropertyIcon kind="score" /> {copy.betterGrade.replace("{to}", grade.to).replace("{from}", grade.from)}</p> : null}
      {canChoose ? <button type="button" disabled={disabled} onClick={() => onChoose(food)} className="mt-2 min-h-11 rounded-full border-2 border-brand-secondary px-4 py-2 text-sm font-semibold text-brand-secondary disabled:opacity-50">{copy.choose}</button> : null}
    </li>; })}</ul> : <p role="status" className="mt-3 text-sm text-brand-secondary">{["all", "brand", "grade"].includes(preference) ? copy.noSimilar : copy.noLabelAlternative}</p>}
    {similar.length > 2 ? <div className="mt-2 flex items-center justify-center gap-3">
      <button type="button" aria-label={copy.previous} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="min-h-11 min-w-11 rounded-lg border border-brand-secondary/30 px-3 text-brand-secondary disabled:opacity-40">←</button>
      <span role="status" className="text-sm text-brand-secondary">{currentPage * 2 + 1}–{Math.min(currentPage * 2 + 2, similar.length)} / {similar.length}</span>
      <button type="button" aria-label={copy.next} disabled={(currentPage + 1) * 2 >= similar.length} onClick={() => setPage(currentPage + 1)} className="min-h-11 min-w-11 rounded-lg border border-brand-secondary/30 px-3 text-brand-secondary disabled:opacity-40">→</button>
    </div> : null}
    {preference !== "all" || similar.some(food => recordedFoodLabels(food, locale).length) ? <p className="mt-2 text-xs leading-relaxed text-brand-secondary">{copy.labelsNote}</p> : null}
    {family ? <button type="button" disabled={disabled} onClick={() => onSearch(family)} className="mt-3 min-h-11 rounded-full border-2 border-brand-secondary bg-white px-4 py-2 text-sm font-semibold text-brand-secondary focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50">{copy.otherBrands.replace("{food}", family)}</button> : null}
    {plantQuery ? <div className="mt-3 border-t border-brand-secondary/15 pt-3">
      <button type="button" disabled={disabled} onClick={() => onSearch(plantQuery)} className="min-h-11 rounded-full border-2 border-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary focus-visible:ring-2 focus-visible:ring-brand-secondary disabled:opacity-50"><FoodPropertyIcon kind="plant" /> {copy.plantOptions}: <bdi>{plantQuery}</bdi></button>
      <p className="mt-2 text-xs leading-relaxed text-brand-secondary">{copy.plantNote}</p>
    </div> : null}
    <details className="mt-2 text-xs text-brand-secondary"><summary className="min-h-11 cursor-pointer py-3 font-semibold">{foodExperience(locale).copy.sourceDetails}</summary>
      <p className="mt-2 leading-relaxed">{copy.gradeNote}</p><p className="mt-2 leading-relaxed">{copy.suggestionNote}</p>
    </details>
  </>;
  return embedded ? <div>{content}</div> : <details className="mt-4 rounded-xl border border-brand-secondary/20 bg-brand-bg p-3">
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-secondary focus-visible:ring-2 focus-visible:ring-brand-primary">{copy.alternatives}</summary>
    {content}
  </details>;
}
