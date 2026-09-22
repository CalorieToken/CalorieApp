import recipes from "@/data/food-recipes.json";
import copy from "@/config/food-recipe-copy.json";
import { recipeFamily } from "@/lib/foodDiscovery";
import type { FoodSearchItem } from "@/components/foodTypes";
import { resolveLocale } from "@/lib/locales";

export const cuisines = ["any", "dutch", "mediterranean", "southAsian", "eastAsian", "middleEastern", "latinAmerican", "westAfrican"] as const;
export const diets = ["any", "vegetarian", "plant"] as const;
export const meals = ["any", "breakfast", "lunch", "dinner"] as const;
export type RecipePreferences = { cuisine: typeof cuisines[number]; diet: typeof diets[number]; meal: typeof meals[number] };
export function recipeCopy(locale: string) { return copy[resolveLocale(locale) as keyof typeof copy] ?? copy.en; }

export function recipeIdeas(food: FoodSearchItem, preferences: RecipePreferences) {
  const family = recipeFamily(food);
  if (!family) return [];
  const tags = new Set(food.labels_tags ?? []);
  const sourceBasic = !food.barcode && /^USDA FoodData Central · FDC \d+$/.test(food.brand ?? "");
  const animal = ["milk", "yogurt", "cheese", "egg", "chicken", "fish"].includes(family);
  // A recipe preference cannot turn an unverified packaged product into a vegan one.
  if (preferences.diet === "plant" && !tags.has("en:vegan") && !(sourceBasic && !animal)) return [];
  if (preferences.diet === "vegetarian" && !tags.has("en:vegan") && !tags.has("en:vegetarian") && !(sourceBasic && !["chicken", "fish", "cheese"].includes(family))) return [];
  return recipes.filter(recipe => recipe.families.includes(family)
    && (preferences.cuisine === "any" || recipe.cuisine === preferences.cuisine)
    && (preferences.meal === "any" || recipe.meals.includes(preferences.meal))
    && (preferences.diet === "any" || recipe.diet === "plant" || (preferences.diet === "vegetarian" && recipe.diet === "vegetarian"))).slice(0, 2);
}
