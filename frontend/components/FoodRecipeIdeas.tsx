"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { RecipeNutrition } from "@/components/RecipeNutrition";
import { discoveryCopy } from "@/lib/foodDiscovery";
import type { FoodSearchItem } from "@/components/foodTypes";
import { cuisines, diets, meals, recipeCopy, recipeIdeas, recipeVariants, type RecipePreferences } from "@/lib/foodRecipes";

export function FoodRecipeIdeas({ food, locale, embedded = false, onLog, onIngredient, disabled = false }: {
  food: FoodSearchItem; locale: string; embedded?: boolean; disabled?: boolean;
  onLog?: (food: FoodSearchItem) => void; onIngredient?: (fdcId: number, grams: number) => void;
}) {
  const copy = recipeCopy(locale);
  const [preferences, setPreferences] = useState<RecipePreferences>({ cuisine: "any", diet: "any", meal: "any" });
  const [page, setPage] = useState(0);
  const groupId = useId();
  const ideas = recipeIdeas(food, preferences);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(ideas.length / 2) - 1));
  const contentLanguage = locale.startsWith("nl") ? "nl" : "en";
  const content = <>
    <p className="mt-2 text-xs leading-relaxed text-brand-secondary">{copy.note}</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {([{ key: "diet", title: copy.diet, values: diets }, { key: "cuisine", title: copy.cuisine, values: cuisines }, { key: "meal", title: copy.meal, values: meals }] as const).map(field => <label key={field.key} className="min-w-0 text-xs font-semibold text-brand-secondary">{field.title}
        <select value={preferences[field.key]} onChange={event => { setPage(0); setPreferences(current => ({ ...current, [field.key]: event.target.value })); }} className="mt-1 min-h-11 w-full rounded-lg border border-brand-secondary/30 bg-white px-2 text-sm">
          {field.values.map(value => <option key={value} value={value}>{copy[value]}</option>)}
        </select>
      </label>)}
    </div>
    <div role="status" className="mt-3 text-sm text-brand-secondary">{ideas.length ? "" : copy.empty}</div>
    {!ideas.length && Object.values(preferences).some(value => value !== "any") ? <button type="button" className="min-h-11 text-sm font-semibold text-brand-secondary underline" onClick={() => { setPreferences({ cuisine: "any", diet: "any", meal: "any" }); setPage(0); }}>{copy.reset}</button> : null}
    {ideas.length ? <ul className="mt-2 grid gap-2 sm:grid-cols-2">{ideas.slice(currentPage * 2, currentPage * 2 + 2).map(idea => <li key={idea.id} lang={contentLanguage} className="rounded-lg bg-brand-bg p-3 text-sm text-brand-secondary">
      <RecipeIdeaCard idea={idea} locale={locale} groupId={groupId} onLog={onLog} onIngredient={onIngredient} disabled={disabled} />
    </li>)}</ul> : null}
    {ideas.length > 2 ? <div className="mt-2 flex items-center justify-center gap-3">
      <button type="button" aria-label={copy.previous} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="min-h-11 min-w-11 rounded-lg border border-brand-secondary/30 px-3 text-brand-secondary disabled:opacity-40">←</button>
      <span role="status" className="text-sm text-brand-secondary">{currentPage * 2 + 1}–{Math.min(currentPage * 2 + 2, ideas.length)} / {ideas.length}</span>
      <button type="button" aria-label={copy.next} disabled={(currentPage + 1) * 2 >= ideas.length} onClick={() => setPage(currentPage + 1)} className="min-h-11 min-w-11 rounded-lg border border-brand-secondary/30 px-3 text-brand-secondary disabled:opacity-40">→</button>
    </div> : null}
    {ideas.length ? <p className="mt-2 text-xs text-brand-secondary">{copy.imageNote}</p> : null}
    {contentLanguage === "en" && !locale.startsWith("en") && ideas.length ? <p className="mt-2 text-xs text-brand-secondary">{copy.english}</p> : null}
    <p className="mt-3 text-xs leading-relaxed text-brand-secondary">{discoveryCopy(locale).suggestionNote}</p>
  </>;
  return embedded ? <div>{content}</div> : <details className="mt-3 rounded-xl border border-brand-secondary/20 p-3">
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-secondary">{copy.title}</summary>
    {content}
  </details>;
}

function RecipeIdeaCard({ idea, locale, groupId, onLog, onIngredient, disabled }: {
  idea: ReturnType<typeof recipeIdeas>[number]; locale: string; groupId: string; disabled: boolean;
  onLog?: (food: FoodSearchItem) => void; onIngredient?: (fdcId: number, grams: number) => void;
}) {
  const [variant, setVariant] = useState(0);
  const variations = recipeVariants(idea), recipe = variations[variant] ?? idea;
  const nl = locale.startsWith("nl"), language = nl ? "nl" : "en", copy = recipeCopy(locale);
  return <details name={groupId}>
    <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand-primary">
      <Image src={`/images/recipes/${idea.image}.webp`} alt="" width={96} height={96} loading="lazy" className="float-start me-3 h-20 w-20 rounded-xl object-contain" />
      {idea[language].title}<span className="mt-1 block text-xs font-normal text-brand-secondary">{copy[idea.cuisine as keyof typeof copy]}</span>
      <span className="block clear-both" />
    </summary>
    <label className="mt-2 block text-sm font-semibold">{nl ? "Kies je uitvoering" : "Choose your variation"}
      <select value={variant} onChange={event => setVariant(Number(event.target.value))} disabled={disabled} className="mt-1 min-h-11 w-full rounded-lg border border-brand-secondary/30 bg-white px-2">
        {variations.map((choice,index) => <option value={index} key={choice.id}>{index === 0 ? nl ? "Basisrecept" : "Base recipe" : choice[language].title.split(" — ").at(-1)}</option>)}
      </select>
    </label>
    <p className="mt-2 leading-relaxed">{recipe[language].method}</p>
    <RecipeNutrition key={recipe.id} recipe={recipe} locale={locale} onLog={onLog} onIngredient={onIngredient} disabled={disabled} />
  </details>;
}
