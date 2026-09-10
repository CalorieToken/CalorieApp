import type { FoodSearchItem } from "@/components/foodTypes";
import copy from "@/config/food-log-filter-copy.json";
import { localeDirection, resolveLocale } from "@/lib/locales";

function searchText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Filter the already loaded private view without changing its records. */
export function filterLoggedFoods(logs: FoodSearchItem[], query: string): FoodSearchItem[] {
  const needle = searchText(query.trim());
  if (!needle) return logs;
  return logs.filter((item) =>
    [item.product_name, item.brand, item.barcode].some((value) =>
      typeof value === "string" && searchText(value).includes(needle)
    )
  );
}

export function getFoodLogFilterCopy(locale?: string) {
  const resolved = resolveLocale(locale);
  return {
    locale: resolved,
    direction: localeDirection(resolved),
    copy: copy[resolved as keyof typeof copy] ?? copy.en,
  };
}
