export const NUTRITION_SUMMARY_MESSAGE = "calorieapp:nutrition-summary";

const GRADE_KEYS = ["A", "B", "C", "D", "E"] as const;
const SUPPORTED_LOCALES = new Set([
  "en", "nl", "zh-Hans", "hi", "es", "ar", "fr", "bn", "pt", "id", "ur",
]);
const SUPPORTED_PERIODS = new Set(["day", "week", "month", "all"]);
const MAX_SUMMARY_ENTRIES = 100_000;

type SummaryInput = {
  authenticated: boolean;
  loading: boolean;
  unavailable: boolean;
  locale: string;
  period: string;
  overview: {
    count?: unknown;
    grades?: unknown;
    sources?: unknown;
  };
};

export type NutritionSummaryMessage = {
  type: typeof NUTRITION_SUMMARY_MESSAGE;
  version: 1;
  locale: string;
  period: string;
  status: "signed_out" | "loading" | "unavailable" | "ready";
  total?: number;
  known?: number;
  missing?: number;
  counts?: Record<(typeof GRADE_KEYS)[number], number>;
  sources?: {
    open_food_facts: number;
    usda: number;
    other: number;
  };
};

function safeCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= 0 && value <= MAX_SUMMARY_ENTRIES ? value : null;
}

/**
 * Build the only private diary information that may leave the embedded app.
 * This intentionally excludes food names, nutrient totals, dates, account IDs
 * and any averaged or inferred diet score.
 */
export function nutritionSummaryMessage(input: SummaryInput): NutritionSummaryMessage {
  const locale = SUPPORTED_LOCALES.has(input.locale) ? input.locale : "en";
  const period = SUPPORTED_PERIODS.has(input.period) ? input.period : "day";
  const base: Pick<NutritionSummaryMessage, "type" | "version" | "locale" | "period"> = {
    type: NUTRITION_SUMMARY_MESSAGE,
    version: 1,
    locale,
    period,
  };

  if (!input.authenticated) return { ...base, status: "signed_out" };
  if (input.loading) return { ...base, status: "loading" };
  if (input.unavailable) return { ...base, status: "unavailable" };

  const total = safeCount(input.overview.count);
  const rawGrades = input.overview.grades;
  const rawSources = input.overview.sources;
  if (total === null || !rawGrades || typeof rawGrades !== "object" || Array.isArray(rawGrades) ||
      !rawSources || typeof rawSources !== "object" || Array.isArray(rawSources)) {
    return { ...base, status: "unavailable" };
  }

  const sources = {
    open_food_facts: safeCount((rawSources as Record<string, unknown>).open_food_facts),
    usda: safeCount((rawSources as Record<string, unknown>).usda),
    other: safeCount((rawSources as Record<string, unknown>).other),
  };
  if (Object.values(sources).some(value => value === null)) {
    return { ...base, status: "unavailable" };
  }
  const safeSources = sources as {open_food_facts: number; usda: number; other: number};
  if (safeSources.open_food_facts + safeSources.usda + safeSources.other !== total) {
    return { ...base, status: "unavailable" };
  }

  const counts = {} as Record<(typeof GRADE_KEYS)[number], number>;
  let known = 0;
  for (const grade of GRADE_KEYS) {
    const count = safeCount((rawGrades as Record<string, unknown>)[grade] ?? 0);
    if (count === null) return { ...base, status: "unavailable" };
    counts[grade] = count;
    known += count;
  }
  if (!Number.isSafeInteger(known) || known > safeSources.open_food_facts) {
    return { ...base, status: "unavailable" };
  }

  return {
    ...base,
    status: "ready",
    total,
    known,
    missing: safeSources.open_food_facts - known,
    counts,
    sources: safeSources,
  };
}

function trustedWordPressParentOrigin(): string | null {
  if (typeof window === "undefined" || typeof document === "undefined" ||
      window.parent === window || !document.referrer) return null;
  try {
    const parent = new URL(document.referrer);
    const production = parent.protocol === "https:" &&
      ["calorietoken.net", "www.calorietoken.net"].includes(parent.hostname);
    const local = ["http:", "https:"].includes(parent.protocol) &&
      ["localhost", "127.0.0.1"].includes(parent.hostname);
    return production || local ? parent.origin : null;
  } catch {
    return null;
  }
}

export function postNutritionSummaryToParent(message: NutritionSummaryMessage): boolean {
  const origin = trustedWordPressParentOrigin();
  if (!origin) return false;
  window.parent.postMessage(message, origin);
  return true;
}
