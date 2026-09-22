"use client";

import { useState } from "react";
import type { FoodSearchItem } from "@/components/foodTypes";
import { cuisines, diets, meals, recipeCopy, recipeIdeas, type RecipePreferences } from "@/lib/foodRecipes";

export function FoodRecipeIdeas({ food, locale }: { food: FoodSearchItem; locale: string }) {
  const copy = recipeCopy(locale);
  const [preferences, setPreferences] = useState<RecipePreferences>({ cuisine: "any", diet: "any", meal: "any" });
  const ideas = recipeIdeas(food, preferences);
  const contentLanguage = locale.startsWith("nl") ? "nl" : "en";
  return <details className="mt-3 rounded-xl border border-brand-secondary/20 p-3">
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-secondary">{copy.title}</summary>
    <p className="mt-2 text-xs leading-relaxed text-brand-secondary">{copy.note}</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {([{ key: "diet", title: copy.diet, values: diets }, { key: "cuisine", title: copy.cuisine, values: cuisines }, { key: "meal", title: copy.meal, values: meals }] as const).map(field => <label key={field.key} className="min-w-0 text-xs font-semibold text-brand-secondary">{field.title}
        <select value={preferences[field.key]} onChange={event => setPreferences(current => ({ ...current, [field.key]: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-brand-secondary/30 bg-white px-2 text-sm">
          {field.values.map(value => <option key={value} value={value}>{copy[value]}</option>)}
        </select>
      </label>)}
    </div>
    <div role="status" className="mt-3 text-sm text-brand-secondary">{ideas.length ? "" : copy.empty}</div>
    {ideas.length ? <ul className="mt-2 space-y-2">{ideas.map(idea => <li key={idea.id} lang={contentLanguage} className="rounded-lg bg-brand-bg p-3 text-sm text-brand-secondary">
      <h4 className="font-semibold text-brand-primary">{idea[contentLanguage].title}</h4>
      <p className="mt-2">{idea[contentLanguage].ingredients.replace("{food}", food.product_name)}</p>
      <p className="mt-2 leading-relaxed">{idea[contentLanguage].method}</p>
    </li>)}</ul> : null}
    {contentLanguage === "en" && !locale.startsWith("en") && ideas.length ? <p className="mt-2 text-xs text-brand-secondary">{copy.english}</p> : null}
  </details>;
}
