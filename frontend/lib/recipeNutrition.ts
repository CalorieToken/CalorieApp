import catalogue from "@/data/recipe-ingredients.json";
import type { FoodSearchItem } from "@/components/foodTypes";

type Ingredient = { key: string; grams: number };
export type RecipeQuantities = { id: string; servings: number; ingredients: Ingredient[]; nl: { title: string }; en: { title: string } };
const reference = catalogue.ingredients as Record<string, typeof catalogue.ingredients.rice>;
export const nutritionKeys = ["calories", "protein", "fat", "carbohydrates"] as const;

export function estimateRecipe(recipe: RecipeQuantities) {
  if (!Number.isFinite(recipe.servings) || recipe.servings <= 0 || !recipe.ingredients.length) return null;
  const total = { calories: 0, protein: 0, fat: 0, carbohydrates: 0 };
  const ingredients = [];
  for (const ingredient of recipe.ingredients) {
    const source = reference[ingredient.key];
    if (!source || !Number.isFinite(ingredient.grams) || ingredient.grams <= 0) return null;
    for (const key of nutritionKeys) {
      const value = source.per100g[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
      total[key] += value * ingredient.grams / 100;
    }
    ingredients.push({ ...ingredient, source });
  }
  return { perServing: Object.fromEntries(nutritionKeys.map(key => [key, total[key] / recipe.servings])) as typeof total,
    total, ingredients, retrievedOn: catalogue.retrieved_on };
}

/** Keeps a recipe estimate distinct from an OFF product or an original USDA record. */
export function recipeLogItem(recipe: RecipeQuantities, servings: number, locale: string): FoodSearchItem | null {
  const estimate = estimateRecipe(recipe);
  if (!estimate || !Number.isFinite(servings) || servings < 0.25 || servings > 8) return null;
  const nl = locale.startsWith("nl");
  return {
    product_name: `${recipe[nl ? "nl" : "en"].title} (${nl ? "receptschatting" : "recipe estimate"})`,
    ...Object.fromEntries(nutritionKeys.map(key => [key, Math.round(estimate.perServing[key] * servings * 100) / 100])) as typeof estimate.perServing,
    brand: `CalorieApp recipe estimate · ${recipe.id} · USDA ingredients`,
    barcode: null, image_url: null, nutri_score: null,
    serving_size: `${servings} ${nl ? "portie(s), geschat met vaste receptingrediënten" : "serving(s), estimated from the listed recipe ingredients"}`,
  };
}
