import translations from "@/config/food-source-copy.json";
import { localeDirection, resolveLocale } from "@/lib/locales";

export type FoodSource = "open_food_facts" | "usda" | "other";
export type FoodSourceCounts = Record<FoodSource, number>;

export function foodSourceCopy(value?: string | null) {
  const locale = resolveLocale(value);
  return {
    locale,
    direction: localeDirection(locale),
    copy: translations[locale as keyof typeof translations] ?? translations.en,
  };
}

export function foodSource(item: {
  barcode?: string | null;
  brand?: string | null;
}): FoodSource {
  if (!item.barcode && /^USDA FoodData Central · FDC \d+$/.test(item.brand?.trim() ?? "")) {
    return "usda";
  }
  if (typeof item.barcode === "string" && item.barcode.trim()) {
    return "open_food_facts";
  }
  return "other";
}

export function safeFoodImageUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "images.openfoodfacts.org" &&
      url.pathname.startsWith("/images/products/") ? url.href : null;
  } catch {
    return null;
  }
}

export function foodFallbackImage(source: FoodSource): string {
  return `/images/food-placeholder-${source === "open_food_facts" ? "off" : source}.svg`;
}

export function validFoodSourceCounts(value: unknown, expectedTotal?: number): FoodSourceCounts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys: FoodSource[] = ["open_food_facts", "usda", "other"];
  const result = {} as FoodSourceCounts;
  let total = 0;
  for (const key of keys) {
    const count = record[key];
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || count > 100_000) return null;
    result[key] = count;
    total += count;
  }
  if (!Number.isSafeInteger(total) || (expectedTotal !== undefined && total !== expectedTotal)) return null;
  return result;
}
