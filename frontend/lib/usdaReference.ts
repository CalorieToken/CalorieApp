export function parseReferenceGrams(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const grams = Number(normalized);
  return Number.isFinite(grams) && grams >= 0.1 && grams <= 5000 ? grams : null;
}

export function referenceNutrientAmount(
  nutrient: { amount: unknown; unit: string; loq: number | null } | undefined,
  unit: string,
  grams: number | null,
): number | null {
  if (!nutrient || nutrient.unit !== unit || typeof nutrient.amount !== "number" ||
      !Number.isFinite(nutrient.amount) || nutrient.amount < 0 ||
      (nutrient.amount === 0 && nutrient.loq !== null) ||
      grams === null || !Number.isFinite(grams) || grams < 0.1 || grams > 5000) return null;
  // Scale the original precision, rounding only when presenting the result.
  return nutrient.amount * grams / 100;
}
