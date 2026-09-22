import translations from "@/config/food-discovery-copy.json";
import { resolveLocale } from "@/lib/locales";
import type { FoodSearchItem } from "@/components/foodTypes";

export type UsdaNutrient = { id: number; name: string; unit: string; amount: number | null; loq: number | null };
export type UsdaFood = { fdc_id: number; description: string; data_type: string; category: string; edition: string; nutrients: UsdaNutrient[] };
export type UsdaCatalogue = { version: number; retrieved_on: string; source: string; basis: string; foods: UsdaFood[] };

export function discoveryCopy(locale: string) {
  return translations[resolveLocale(locale) as keyof typeof translations] ?? translations.en;
}

export function normalizeFoodText(value: string): string {
  return value.normalize("NFKC").toLowerCase().normalize("NFD")
    .replace(/([a-z])[\u0300-\u036f]+/g, "$1").normalize("NFC").trim();
}

function normalizeDigits(value: string): string {
  return value.normalize("NFKC").replace(/[٠-٩۰-۹०-९০-৯]/g, character => {
    const point = character.codePointAt(0)!;
    const base = [0x660, 0x6f0, 0x966, 0x9e6].find(start => point >= start && point <= start + 9)!;
    return String(point - base);
  });
}

export function normalizeFoodNumber(value: string): string {
  return normalizeDigits(value).replace(/[٫,]/g, ".").trim();
}

export function edibleGrams(value: string, locale = "en"): number | null {
  let text = normalizeDigits(value).trim();
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  // Arabic separators are unambiguous even where the runtime defaults ar to
  // Latin digits. Do not depend on a particular ICU numbering-system default.
  const grouping = text.includes("٬") ? "٬" : parts.find(part => part.type === "group")?.value.normalize("NFKC");
  const decimal = text.includes("٫") ? "٫" : parts.find(part => part.type === "decimal")?.value;
  if (grouping && text.includes(grouping)) {
    const whole = text.split(decimal ?? ".")[0];
    const groups = whole.split(grouping);
    // Interpret 1,000 / 1.000 using the active display language, not a
    // universal comma-to-dot replacement which could change a portion 1000×.
    if (groups.length > 1 && /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every(group => /^\d{3}$/.test(group))) {
      text = text.split(grouping).join("");
    }
  }
  text = normalizeFoodNumber(text);
  if (!/^\d+(?:\.\d{1,3})?$/.test(text)) return null;
  const grams = Number(text);
  return Number.isFinite(grams) && grams >= 0.1 && grams <= 5000 ? grams : null;
}

// Search aids, not translations of the underlying USDA records. Original food
// descriptions and preparation words remain visible beside every result.
const families: Record<string, string[]> = {
  rice: ["rice", "rijst", "米饭", "大米", "चावल", "arroz", "أرز", "ارز", "riz", "ভাত", "চাল", "beras", "nasi", "چاول"],
  oat: ["oat", "oats", "oatmeal", "haver", "havermout", "燕麦", "जई", "ओट्स", "avena", "شوفان", "avoine", "ওটস", "aveia", "gandum oat", "جئی"],
  milk: ["milk", "melk", "牛奶", "दूध", "leche", "حليب", "lait", "দুধ", "leite", "susu", "دودھ"],
  yogurt: ["yogurt", "yoghurt", "酸奶", "दही", "yogur", "زبادي", "yaourt", "দই", "iogurte", "دہی"],
  bread: ["bread", "brood", "面包", "ब्रेड", "रोटी", "pan", "خبز", "pain", "রুটি", "pão", "roti", "روٹی"],
  apple: ["apple", "apples", "appel", "appels", "苹果", "सेब", "manzana", "تفاح", "pomme", "আপেল", "maçã", "apel", "سیب"],
  banana: ["banana", "bananas", "banaan", "bananen", "香蕉", "केला", "plátano", "موز", "banane", "কলা", "pisang", "کیلا"],
  lentil: ["lentil", "lentils", "linzen", "扁豆", "मसूर", "lenteja", "عدس", "lentille", "মসুর", "lentilha", "lentil", "مسور"],
  chickpea: ["chickpea", "chickpeas", "garbanzo", "kikkererwten", "鹰嘴豆", "चना", "garbanzo", "حمص", "pois chiche", "ছোলা", "grão-de-bico", "kacang arab", "چنے"],
  potato: ["potato", "potatoes", "aardappel", "aardappelen", "土豆", "आलू", "patata", "papa", "بطاطس", "بطاطا", "pomme de terre", "আলু", "batata", "kentang", "آلو"],
  tomato: ["tomato", "tomatoes", "tomaat", "tomaten", "番茄", "टमाटर", "tomate", "طماطم", "টমেটো", "tomat", "ٹماٹر"],
  chicken: ["chicken", "kip", "鸡肉", "चिकन", "pollo", "دجاج", "poulet", "মুরগি", "frango", "ayam", "مرغی"],
  fish: ["fish", "vis", "鱼", "मछली", "pescado", "سمك", "poisson", "মাছ", "peixe", "ikan", "مچھلی"],
  tofu: ["tofu", "tahoe", "豆腐", "टोफू", "توفو", "টফু", "tahu", "ٹوفو"],
  pasta: ["pasta", "macaroni", "意大利面", "पास्ता", "معكرونة", "pâtes", "পাস্তা", "massa", "پاستا"],
  egg: ["egg", "eggs", "ei", "eieren", "鸡蛋", "अंडा", "huevo", "بيض", "œuf", "oeuf", "ডিম", "ovo", "telur", "انڈا"],
  cheese: ["cheese", "kaas", "奶酪", "चीज़", "queso", "جبن", "fromage", "চিজ", "queijo", "keju", "پنیر"],
  coffee: ["coffee", "koffie", "咖啡", "कॉफी", "café", "قهوة", "কফি", "kopi", "کافی"],
  cereal: ["cereal", "cereals", "cornflakes", "ontbijtgranen", "早餐麦片", "नाश्ते के अनाज", "cereales", "حبوب الإفطار", "céréales", "সিরিয়াল", "cereais", "sereal", "ناشتے کے اناج"]
};
const aliases = new Map(Object.entries(families).flatMap(([key, names]) => names.map(name => [normalizeFoodText(name), key] as const)));
const words = (text: string) => normalizeFoodText(text).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
const ignored = new Set("a an the and with without of for in to by food foods brand product products ready eat prepared commercial unsalted salt added g ml pack original natural".split(" "));
const significantWords = (text: string) => words(text).filter(word => word.length > 2 && !ignored.has(word) && !/^\d+$/.test(word));

export function foodFamily(text: string): string | null {
  const tokens = new Set(words(text));
  const normalized = normalizeFoodText(text);
  const found = Object.entries(families).filter(([, names]) => names.some(name => {
    const key = normalizeFoodText(name);
    return key.includes(" ") ? normalized.includes(key) : /[\u3400-\u9fff]/.test(key) ? normalized.includes(key) : tokens.has(key);
  }));
  // Mixed foods do not inherit an ingredient's identity (e.g. milk + oats).
  return found.length === 1 ? found[0][0] : null;
}

export function searchUsda(foods: UsdaFood[], query: string): UsdaFood[] {
  const normalized = normalizeFoodText(normalizeFoodNumber(query));
  if (!normalized || normalized.length > 160) return [];
  const fdc = normalized.match(/^(?:fdc[\s:#-]*)?(\d+)$/);
  if (fdc) return foods.filter(food => String(food.fdc_id) === fdc[1]);
  const translated = aliases.get(normalized) ?? normalized;
  const tokens = words(translated).map(token => aliases.get(token) ?? token);
  if (!tokens.length) return [];
  return foods.map(food => {
    const name = normalizeFoodText(food.description);
    const terms = words(name);
    const matches = tokens.every(token => terms.some(term => term === token || (token.length >= 3 && term.startsWith(token))));
    return { food, score: !matches ? -1 : (name === translated ? 100 : name.startsWith(translated + ",") ? 50 : 0) + (food.data_type === "Foundation" ? 10 : 0) };
  }).filter(result => result.score >= 0).sort((a, b) => b.score - a.score || a.food.description.localeCompare(b.food.description, "en") || a.food.fdc_id - b.food.fdc_id).map(result => result.food);
}

export function similarFoodNames<T>(current: T, candidates: T[], nameOf: (food: T) => string, idOf: (food: T) => string, limit = 3): T[] {
  const name = nameOf(current), family = foodFamily(name), tokens = new Set(significantWords(name));
  const sensitive = /\b(infant|baby|formula|supplement|medical|therapeutic|enteral)\b/i;
  if (sensitive.test(name)) return [];
  const seen = new Set([idOf(current)]);
  return candidates.map(food => {
    const candidateName = nameOf(food);
    if (seen.has(idOf(food)) || sensitive.test(candidateName) || normalizeFoodText(candidateName) === normalizeFoodText(name)) return { food, score: 0 };
    seen.add(idOf(food));
    const candidateTokens = new Set(significantWords(candidateName));
    const shared = [...tokens].filter(token => candidateTokens.has(token)).length;
    const sharedFamily = family !== null && family === foodFamily(candidateName);
    const overlap = shared / Math.max(tokens.size, candidateTokens.size, 1);
    return { food, score: sharedFamily ? 2 + overlap : shared >= 2 && overlap >= 0.5 ? overlap : 0 };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score || nameOf(a.food).localeCompare(nameOf(b.food))).slice(0, limit).map(result => result.food);
}

export function usdaNutrient(food: UsdaFood, id: number, unit: string): number | null {
  const nutrient = food.nutrients.find(value => value.id === id && value.unit.toLowerCase() === unit.toLowerCase());
  const amount = nutrient?.amount;
  return typeof amount === "number" && Number.isFinite(amount) && amount >= 0 && !(amount === 0 && typeof nutrient?.loq === "number" && nutrient.loq > 0) ? amount : null;
}

export function usdaNutrition(food: UsdaFood, grams = 100) {
  const energyId = [2047, 1008, 2048].find(id => usdaNutrient(food, id, "kcal") !== null);
  const base = { calories: energyId ? usdaNutrient(food, energyId, "kcal") : null, protein: usdaNutrient(food, 1003, "g"), fat: usdaNutrient(food, 1004, "g"), carbohydrates: usdaNutrient(food, 1005, "g") };
  const scale = (amount: number | null) => amount !== null && Number.isFinite(grams) && grams >= 0.1 && grams <= 5000 ? amount * grams / 100 : null;
  return { calories: scale(base.calories), protein: scale(base.protein), fat: scale(base.fat), carbohydrates: scale(base.carbohydrates), energyId: energyId ?? null };
}

export function usdaLogItem(food: UsdaFood, grams: number): FoodSearchItem | null {
  const nutrition = usdaNutrition(food, grams);
  const { calories, protein, fat, carbohydrates } = nutrition;
  if ([calories, protein, fat, carbohydrates].some(value => value === null)) return null;
  return { product_name: food.description.slice(0, 120), calories: calories!, protein: protein!, fat: fat!, carbohydrates: carbohydrates!,
    // The existing diary/export contract preserves these display fields. No
    // database migration or fabricated product barcode is needed for this lane.
    brand: `USDA FoodData Central · FDC ${food.fdc_id}`, serving_size: `${grams} g edible · ${food.edition}`,
    barcode: null, image_url: null, nutri_score: null, portion_percentage: 100 };
}

/** Brand names never establish nutritional similarity. Keep the original label for display. */
export function unbrandedFoodName(food: FoodSearchItem): string {
  let name = normalizeFoodText(food.product_name);
  const brands = (food.brand ?? "").split(/[,;]+/).map(normalizeFoodText).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const brand of brands) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    name = name.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "gu"), "$1 ");
  }
  return name.replace(/\s+/g, " ").trim();
}

const packagedGroups: Record<string, string[]> = {
  juice: ["juice", "sap", "jus", "zumo", "suco", "果汁"],
  icecream: ["ice cream", "icecream", "ijs", "glace", "helado", "sorvete"],
  jam: ["jam", "marmalade", "confiture", "mermelada"],
  readymeal: ["ready meal", "maaltijd", "lasagne", "lasagna", "risotto"],
  spread: ["spread", "pindakaas", "peanut butter", "hazelnut spread", "chocopasta"],
  biscuit: ["biscuit", "biscuits", "cookie", "cookies", "koek", "koekjes", "galletas"],
  crisps: ["crisps", "chips", "tortilla chips"],
  soup: ["soup", "soep", "soupe", "sopa"],
  sauce: ["sauce", "saus", "salsa"],
  pizza: ["pizza"],
  plantdrink: ["oat drink", "oat milk", "oatmilk", "havermelk", "haverdrink", "sojadrink", "sojamelk", "soy drink", "soy milk", "soymilk", "almond drink", "almond milk", "amandelmelk", "rice drink", "rice milk", "rijstdrink", "rijstmelk", "boisson avoine", "lait d'avoine", "bebida de avena", "leche de avena", "leite de aveia"],
  chocolate: ["chocolate", "chocolade", "chocolat", "巧克力", "चॉकलेट"],
};
const sensitiveFood = /\b(infant|baby|formula|supplement|medical|therapeutic|enteral|zuigeling|medisch)\b/i;
const containsTerm = (text: string, term: string) => {
  const pieces = words(term), tokens = words(text);
  return pieces.length > 0 && tokens.some((_, index) => pieces.every((piece, offset) => tokens[index + offset] === piece));
};

function packagedFamily(food: FoodSearchItem): string | null {
  const name = unbrandedFoodName(food);
  if (sensitiveFood.test(food.product_name)) return null;
  const family = foodFamily(name);
  for (const [key, terms] of Object.entries(packagedGroups)) {
    // Chocolate milk/cereal/yogurt are not chocolate bars.
    if (key === "chocolate" && family) continue;
    if (terms.some(term => containsTerm(name, term))) return key;
  }
  return family;
}

export function alternativeSearchQuery(food: FoodSearchItem): string {
  if (sensitiveFood.test(food.product_name)) return "";
  const name = unbrandedFoodName(food);
  const family = packagedFamily(food);
  // Use the category term actually present on the label, retaining its language.
  const terms = family ? packagedGroups[family] ?? families[family] ?? [] : [];
  return (terms.find(term => containsTerm(name, normalizeFoodText(term))) ?? name)
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|cl|l)\b/gi, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

function knownGrade(food: FoodSearchItem): string | null {
  const grade = food.nutri_score?.trim().toUpperCase();
  return grade && /^[A-E]$/.test(grade) ? grade : null;
}

/** Recorded grades are a limited comparison cue, never a newly calculated health score. */
export function betterRecordedGrade(current: FoodSearchItem, candidate: FoodSearchItem): { from: string; to: string } | null {
  const family = packagedFamily(current), from = knownGrade(current), to = knownGrade(candidate);
  if (current.nutriscore_version && candidate.nutriscore_version && current.nutriscore_version !== candidate.nutriscore_version) return null;
  if (!family || family !== packagedFamily(candidate) || !from || !to || to >= from) return null;
  return { from, to };
}

export function packagedAlternatives(current: FoodSearchItem, candidates: FoodSearchItem[], limit = 4): FoodSearchItem[] {
  const name = unbrandedFoodName(current), family = packagedFamily(current);
  const tokens = new Set(significantWords(name));
  if (!name || sensitiveFood.test(current.product_name) || limit <= 0) return [];
  const brandOf = (food: FoodSearchItem) => normalizeFoodText(food.brand ?? "");
  const idOf = (food: FoodSearchItem) => food.barcode?.trim() || `${unbrandedFoodName(food)}|${brandOf(food)}`;
  const seen = new Set([idOf(current)]);
  const pool = candidates.flatMap((food, order) => {
    const id = idOf(food), candidateName = unbrandedFoodName(food);
    if (seen.has(id) || !candidateName || sensitiveFood.test(food.product_name)) return [];
    seen.add(id);
    const candidateTokens = new Set(significantWords(candidateName));
    const shared = [...tokens].filter(token => candidateTokens.has(token)).length;
    const overlap = shared / Math.max(tokens.size, candidateTokens.size, 1);
    const candidateFamily = packagedFamily(food);
    if (family && candidateFamily && family !== candidateFamily) return [];
    const sameFamily = family !== null && family === candidateFamily;
    if (!sameFamily && !(shared >= 2 && overlap >= 0.5)) return [];
    // Duplicate labels from the same brand add little choice; another brand is useful.
    if (candidateName === name && brandOf(food) === brandOf(current)) return [];
    return [{ food, order, score: (sameFamily ? 2 : 0) + overlap }];
  });
  const chosen: FoodSearchItem[] = [], brands = new Set([brandOf(current)]);
  // Reserve one place for an evidenced better grade among comparable foods.
  const better = pool.filter(entry => betterRecordedGrade(current, entry.food)).sort((a, b) =>
    knownGrade(a.food)!.localeCompare(knownGrade(b.food)!) || b.score - a.score || a.order - b.order)[0];
  if (better) { chosen.push(better.food); brands.add(brandOf(better.food)); }
  while (chosen.length < limit) {
    const next = pool.filter(entry => !chosen.includes(entry.food)).sort((a, b) =>
      Number(Boolean(brandOf(b.food)) && !brands.has(brandOf(b.food))) - Number(Boolean(brandOf(a.food)) && !brands.has(brandOf(a.food))) ||
      b.score - a.score || a.order - b.order)[0];
    if (!next) break;
    chosen.push(next.food); brands.add(brandOf(next.food));
  }
  return chosen;
}

/** An explicit search direction, not a certification of the returned products. */
export function plantAlternativeQuery(food: FoodSearchItem, locale: string): string | null {
  const family = packagedFamily(food), copy = discoveryCopy(locale);
  if (!family) return null;
  return ({ milk: copy.plantMilk, yogurt: copy.plantYogurt, cheese: copy.plantCheese,
    chicken: copy.plantProtein, fish: copy.plantProtein, egg: copy.plantProtein } as Record<string, string>)[family] ?? null;
}

export type FoodLabel = { name: string; scope: "organic" | "welfare" | "fishery" };
/** Exact provider tags only. A recorded label is not our own certification. */
export function recordedFoodLabels(food: FoodSearchItem, locale: string): FoodLabel[] {
  const tags = new Set(food.labels_tags ?? []), result: FoodLabel[] = [];
  if (tags.has("en:eu-organic")) result.push({ name: "EU Organic", scope: "organic" });
  else if (tags.has("en:organic")) result.push({ name: discoveryCopy(locale).organicClaim, scope: "organic" });
  const levels = new Set([...tags].flatMap(tag => {
    const match = /^(?:en|nl):beter-leven-([123])-(?:star|stars|ster|sterren)$/.exec(tag);
    return match ? [Number(match[1])] : [];
  }));
  // Conflicting star levels cannot support a clear claim.
  if (levels.size === 1) result.push({ name: `Beter Leven ${"★".repeat([...levels][0])}`, scope: "welfare" });
  if (tags.has("en:msc")) result.push({ name: "MSC", scope: "fishery" });
  if (tags.has("en:asc")) result.push({ name: "ASC", scope: "fishery" });
  return result;
}

export function foodSourceUrl(food: FoodSearchItem): string | null {
  return /^(?:\d{8}|\d{12,14})$/.test(food.barcode ?? "") ? `https://world.openfoodfacts.org/product/${food.barcode}` : null;
}

/** Recipe ideas only use recognised basic foods, not medical foods or mixed ready meals. */
export function recipeFamily(food: FoodSearchItem): string | null {
  const family = packagedFamily(food);
  return family && (Object.hasOwn(families, family) || family === "plantdrink") ? family : null;
}
