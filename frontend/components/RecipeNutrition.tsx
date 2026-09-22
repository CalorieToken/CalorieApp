"use client";
import { useState } from "react";
import { estimateRecipe, recipeLogItem, nutritionKeys, type RecipeQuantities } from "@/lib/recipeNutrition";
import { FoodPropertyIcon } from "@/components/FoodPropertyIcon";
import { discoveryCopy } from "@/lib/foodDiscovery";
import type { FoodSearchItem } from "@/components/foodTypes";

export function RecipeNutrition({ recipe, locale, onLog, onIngredient, disabled = false }: {
  recipe: RecipeQuantities; locale: string; disabled?: boolean;
  onLog?: (food: FoodSearchItem) => void; onIngredient?: (fdcId: number, grams: number) => void;
}) {
  const nl = locale.startsWith("nl"), language = nl ? "nl" : "en", copy = discoveryCopy(locale);
  const [servings, setServings] = useState("1");
  const [ingredientKey, setIngredientKey] = useState(recipe.ingredients[0]?.key ?? "");
  const estimate = estimateRecipe(recipe), item = recipeLogItem(recipe, Number(servings), locale);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (!estimate) return <p className="mt-2 text-sm">{copy.unavailable}</p>;
  return <div className="mt-3 border-t border-brand-secondary/20 pt-3" lang={language}>
    <p className="font-semibold">{nl ? "Geschat per portie" : "Estimated per serving"}</p>
    <dl className="mt-2 grid grid-cols-2 gap-2">{nutritionKeys.map(key => <div key={key}>
      <dt className="text-xs"><FoodPropertyIcon kind={key} /> {copy[key]}</dt>
      <dd className="font-semibold">≈ {key === "calories" ? Math.round(estimate.perServing[key] / 5) * 5 : number.format(estimate.perServing[key])} {key === "calories" ? "kcal" : "g"}</dd>
    </div>)}</dl>
    <p className="mt-3 font-semibold">{nl ? `Ingrediënten voor ${recipe.servings} porties` : `Ingredients for ${recipe.servings} servings`}</p>
    <ul className="mt-2 space-y-1">{estimate.ingredients.map(ingredient => <li key={ingredient.key} className="flex flex-wrap items-center justify-between gap-x-2 border-b border-brand-secondary/10 py-1">
      <span>{number.format(ingredient.grams)} g · {ingredient.source[language]}</span>
    </li>)}</ul>
    {onIngredient ? <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-xs font-semibold">{nl ? "Ingrediënt bekijken" : "Inspect an ingredient"}
        <select value={ingredientKey} onChange={event => setIngredientKey(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-brand-secondary/30 bg-white px-2">
          {estimate.ingredients.map(ingredient => <option key={ingredient.key} value={ingredient.key}>{ingredient.source[language]}</option>)}
        </select>
      </label>
      <button type="button" disabled={disabled} onClick={() => { const ingredient = estimate.ingredients.find(candidate => candidate.key === ingredientKey); if (ingredient) onIngredient(ingredient.source.fdc_id, ingredient.grams / recipe.servings); }} className="min-h-11 rounded-lg border border-brand-secondary/30 px-3 text-xs font-semibold disabled:opacity-50">{nl ? "Bekijk in USDA" : "View in USDA"} →</button>
    </div> : null}
    <p className="mt-3 text-xs leading-relaxed">{nl ? "Berekend met de algemene USDA-ingrediënten en gewichten hierboven, gedeeld door het aantal porties. Jouw merk, vervangingen en bereiding kunnen afwijken. Weeg droog of gekookt zoals vermeld. Geen Nutri-Score of medisch advies." : "Calculated from the generic USDA ingredients and weights above, divided by the servings. Your brand, substitutions and preparation may differ. Weigh dry or cooked as listed. No Nutri-Score or medical advice."}</p>
    {onLog ? <div className="mt-3 rounded-lg bg-white p-3">
      <label className="block text-sm font-semibold">{nl ? "Hoeveel porties wil je loggen?" : "How many servings do you want to log?"}
        <input type="number" min="0.25" max="8" step="0.25" value={servings} disabled={disabled} onChange={event => setServings(event.target.value)}
          className="mt-1 block min-h-11 w-24 rounded-lg border border-brand-secondary/30 px-2" />
      </label>
      <button type="button" disabled={disabled || !item} onClick={() => { if (!disabled && item) onLog(item); }}
        className="mt-2 min-h-11 rounded-full bg-brand-primary px-4 py-2 font-semibold text-white disabled:opacity-50">{nl ? "Log dit recept" : "Log this recipe"}</button>
      <p className="mt-2 text-xs">{nl ? "Hierna controleer en bevestig je de schatting. Er wordt nu nog niets opgeslagen." : "Next, review and confirm the estimate. Nothing is saved yet."}</p>
    </div> : null}
    <details className="mt-2 text-xs"><summary className="min-h-11 cursor-pointer py-3 font-semibold">{nl ? "Berekening en bronnen" : "Calculation and sources"}</summary>
      <p>{nl ? "Per ingrediënt: gram ÷ 100 × USDA-waarde per 100 g. Daarna optellen en delen door porties." : "For each ingredient: grams ÷ 100 × USDA value per 100 g. Sum, then divide by servings."}</p>
      <p className="mt-2">USDA FoodData Central · {estimate.retrievedOn}</p>
      <ul>{estimate.ingredients.map(ingredient => <li key={ingredient.key}><a className="inline-flex min-h-11 items-center underline" href={`https://fdc.nal.usda.gov/food-details/${ingredient.source.fdc_id}/nutrients`} target="_blank" rel="noopener noreferrer">{ingredient.source[language]} · FDC {ingredient.source.fdc_id} ↗</a></li>)}</ul>
    </details>
  </div>;
}
