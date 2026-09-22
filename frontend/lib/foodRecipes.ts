import recipes from "@/data/food-recipes.json";
import copy from "@/config/food-recipe-copy.json";
import { recipeFamily } from "@/lib/foodDiscovery";
import type { FoodSearchItem } from "@/components/foodTypes";
import { resolveLocale } from "@/lib/locales";

export const cuisines = ["any", "dutch", "mediterranean", "southAsian", "eastAsian", "middleEastern", "latinAmerican", "westAfrican", "southeastAsian", "northAfrican", "eastAfrican", "caribbean", "european", "northAmerican", "oceania", "southAfrican"] as const;
export const diets = ["any", "vegetarian", "plant"] as const;
export const meals = ["any", "breakfast", "lunch", "dinner", "snack"] as const;
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
    && (preferences.diet === "any" || recipe.diet === "plant" || (preferences.diet === "vegetarian" && recipe.diet === "vegetarian")));
}

// Variants remain choices within a base recipe, avoiding hundreds of nearly identical cards.
const sweetVariants = [
  ["apple", 100, "met extra appel", "with extra apple", "Snijd de extra appel klein en voeg toe bij het serveren.", "Dice the extra apple and add when serving."],
  ["banana", 100, "met extra banaan", "with extra banana", "Snijd de extra banaan in plakjes en verdeel over de porties.", "Slice the extra banana and divide between servings."],
  ["coconut", 15, "met kokos", "with coconut", "Verdeel de geraspte kokos over de porties.", "Sprinkle the grated coconut over the servings."],
  ["seeds", 15, "met pompoenpitten", "with pumpkin seeds", "Strooi de pompoenpitten over de porties.", "Sprinkle the pumpkin seeds over the servings."],
  ["cinnamon", 2, "met extra kaneel", "with extra cinnamon", "Roer de extra kaneel door het gerecht.", "Stir the extra cinnamon into the dish."],
  ["peanutbutter", 20, "met pindakaas", "with peanut butter", "Roer de pindakaas los met een beetje water en verdeel over de porties.", "Loosen the peanut butter with a little water and divide between servings."],
  ["oat", 20, "met geroosterde havervlokken", "with toasted oats", "Rooster de extra havervlokken kort in een droge pan en gebruik als topping.", "Briefly toast the extra oats in a dry pan and use as a topping."],
] as const;
const savoryVariants = [
  ["peas", 100, "met extra doperwten", "with extra peas", "Kook de extra doperwten gaar en serveer bij het gerecht.", "Cook the extra peas until tender and serve alongside."],
  ["spinach", 100, "met extra spinazie", "with extra spinach", "Laat de extra spinazie slinken in een pan met een scheut water en serveer erbij.", "Wilt the extra spinach in a pan with a splash of water and serve alongside."],
  ["mushroom", 150, "met extra champignons", "with extra mushrooms", "Snijd de extra champignons en stoof ze gaar met een scheut water; serveer erbij.", "Slice the extra mushrooms, simmer with a splash of water until cooked, and serve alongside."],
  ["pepper", 150, "met extra paprika", "with extra pepper", "Snijd de extra paprika en rooster op bakpapier tot zacht; serveer erbij.", "Slice the extra pepper and roast on baking paper until tender; serve alongside."],
  ["carrot", 150, "met extra wortel", "with extra carrot", "Snijd en stoom de extra wortel gaar; serveer bij het gerecht.", "Slice and steam the extra carrot until tender; serve alongside."],
  ["sweetpotato", 150, "met zoete aardappel", "with sweet potato", "Schil de zoete aardappel, snijd in blokjes en kook gaar; serveer erbij.", "Peel and dice the sweet potato, boil until tender, and serve alongside."],
  ["chickpea", 120, "met extra kikkererwten", "with extra chickpeas", "Weeg de extra kikkererwten gekookt en uitgelekt; verwarm en serveer erbij.", "Weigh the extra chickpeas cooked and drained; heat and serve alongside."],
] as const;
export function recipeVariants(recipe: typeof recipes[number]) {
  const variations = ["porridge", "yogurt", "pancake"].includes(recipe.image) ? sweetVariants : savoryVariants;
  return [recipe, ...variations.map(([key, grams, nl, en, nlMethod, enMethod]) => {
    const existing = recipe.ingredients.some(ingredient => ingredient.key === key);
    return { ...recipe, id: `${recipe.id}-extra-${key}`,
      ingredients: existing ? recipe.ingredients.map(ingredient => ingredient.key === key ? { ...ingredient, grams: ingredient.grams + grams } : ingredient) : [...recipe.ingredients, { key, grams }],
      nl: { ...recipe.nl, title: `${recipe.nl.title} — ${nl}`, method: `${recipe.nl.method} Variant: ${nlMethod}` },
      en: { ...recipe.en, title: `${recipe.en.title} — ${en}`, method: `${recipe.en.method} Variation: ${enMethod}` },
    };
  })];
}
