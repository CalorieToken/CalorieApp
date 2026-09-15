import translations from "@/config/food-experience-copy.json";
import { localeDirection, resolveLocale } from "@/lib/locales";

export function foodExperience(value?: string | null) {
  const locale = resolveLocale(value);
  return { locale, direction: localeDirection(locale), copy: translations[locale as keyof typeof translations] ?? translations.en };
}

export const PRODUCT_GRADES = ["A", "B", "C", "D", "E"] as const;
export type ProductGrade = typeof PRODUCT_GRADES[number];
export function productGrade(value?: string | null): ProductGrade | null {
  const key = value?.trim().toUpperCase();
  return PRODUCT_GRADES.includes(key as ProductGrade) ? key as ProductGrade : null;
}

export type RecordedGrades = {
  grades: ReadonlyArray<{ grade: string; count: number }>;
  known: number; total: number; missing: number;
};

/** Validate server-period counts; never turn inconsistent/missing data into a grade. */
export function gradeCoverage(summary: RecordedGrades) {
  const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (!integer(summary.total) || !integer(summary.known) || !integer(summary.missing)) return null;
  if (summary.grades.length !== PRODUCT_GRADES.length) return null;
  const entries = PRODUCT_GRADES.map(grade => summary.grades.filter(entry => entry.grade === grade));
  if (entries.some(group => group.length !== 1 || !integer(group[0].count))) return null;
  const grades = entries.map(group => group[0]);
  const known = grades.reduce((sum, entry) => sum + entry.count, 0);
  if (!Number.isSafeInteger(known) || known !== summary.known || known > summary.total || summary.missing !== summary.total - known) return null;
  return { grades, known, total: summary.total, missing: summary.missing };
}

/** Localize only our exact generated USDA gram label; never reinterpret package text. */
export function displayUsdaGramAmount(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  const match = /^(\d+(?:\.\d+)?) g edible \u00b7 .+$/u.exec(value);
  if (!match) return value;
  const grams = Number(match[1]);
  if (!Number.isFinite(grams) || grams < 0.1 || grams > 5000) return value;
  return `${new Intl.NumberFormat(resolveLocale(locale), { maximumFractionDigits: 3 }).format(grams)} g`;
}
