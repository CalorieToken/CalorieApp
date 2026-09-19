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
