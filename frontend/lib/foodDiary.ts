import translations from "@/config/diary-copy.json";
import type { FoodSearchItem } from "@/components/foodTypes";

export type DiaryPeriod = "day" | "week" | "month" | "all";
export type DiaryOverview = {
  entries: FoodSearchItem[]; next_before: number | null; count: number;
  calories: number; protein: number; fat: number; carbohydrates: number;
  grades: Record<string, number>;
};
export const emptyDiary: DiaryOverview = {entries: [], next_before: null, count: 0,
  calories: 0, protein: 0, fat: 0, carbohydrates: 0, grades: {A: 0, B: 0, C: 0, D: 0, E: 0}};
export function diaryCopy(locale: string) {
  return translations[locale as keyof typeof translations] ?? translations.en;
}
export function localDiaryDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  // Noon avoids DST transitions while moving between calendar dates.
  const result = new Date(year, month - 1, day, 12);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || localDiaryDate(result) !== value) throw new Error("Invalid diary date");
  return result;
}
export function diaryRange(period: DiaryPeriod, date: string) {
  if (period === "all") return null;
  const start = parseDate(date);
  if (period === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (period === "month") start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (period === "month") end.setMonth(end.getMonth() + 1);
  else end.setDate(end.getDate() + (period === "week" ? 7 : 1));
  return {start, end};
}
export function moveDiaryDate(period: DiaryPeriod, date: string, direction: number) {
  const value = parseDate(date);
  if (period === "month") { value.setDate(1); value.setMonth(value.getMonth() + direction); }
  else value.setDate(value.getDate() + direction * (period === "week" ? 7 : 1));
  return localDiaryDate(value);
}
export function diaryParams(period: DiaryPeriod, date: string, before?: number) {
  const params = new URLSearchParams();
  const range = diaryRange(period, date);
  if (range) { params.set("start", range.start.toISOString()); params.set("end", range.end.toISOString()); }
  if (before) params.set("before", String(before));
  return params.toString();
}
