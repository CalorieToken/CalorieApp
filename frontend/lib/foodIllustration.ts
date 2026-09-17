/** Original local food icons. Only a fixed, allowlisted asset name leaves this matcher. */
const groups: [string, string][] = [
  ["sweets", "candy|candies|sweets|snoep|snoepjes|bonbon|bonbons|ice cream|ice creams|ijs|ijsje|roomijs|dessert|desserts|helado|sorbet"],
  ["soup", "soup|soep|sopa|soupe|sup|شوربة|सूप|স্যুপ|汤|سوپ"],
  ["drink", "water|wasser|agua|eau|juice|sap|jus|smoothie|soda|cola|powerade|beverage|beverages|lemonade|limonade|drink|drank|suco|zumo|jugo|عصير|जूस|রস|果汁|جوس"],
  ["yogurt", "yogurt|yoghurt|yoghurts|aardbeienyoghurt|vruchtenyoghurt|yogur|yaourt|iogurte|kwark|vla|pudding|marmorette|danette|زبادي|दही|দই|酸奶|دہی"],
  ["bread", "bread|brood|broden|volkorenbrood|witbrood|bruinbrood|roggebrood|stokbrood|broodje|broodjes|boterham|boterhammen|toast|bagel|bagels|bun|buns|rolls|baguette|croissant|pita|tortilla|wrap|wraps|tortillas|pan|pain|pao|roti|brot|خبز|ब्रेड|रोटी|রুটি|面包|روٹی"],
  ["biscuit", "biscuit|biscuits|cookie|cookies|koek|koekje|koekjes|cracker|crackers|galleta|biscuits|biscoito|بسكويت|बिस्कुट|বিস্কুট|饼干|بسکٹ"],
  ["cake", "cake|cakes|pie|pies|pastry|pastries|waffle|waffles|wafel|wafels|pancake|pancakes|pannenkoek|pannenkoeken|taart|gebak|muffin|muffins|gateau|pastel|bolo|كيك|केक|কেক|蛋糕|کیک"],
  ["chocolate", "chocolate|chocolat|chocolade|cacao|cocoa|schokolade|شوكولاتة|चॉकलेट|চকলেট|巧克力|چاکلیٹ"],
  ["milk", "milk|melk|milch|leche|lait|leite|susu|حليب|दूध|দুধ|牛奶|دودھ"],
  ["cheese", "cheese|kaas|kase|queso|fromage|queijo|keju|جبن|चीज़|চিজ|奶酪|پنیر"],
  ["coffee", "coffee|koffie|espresso|cappuccino|cafe|kopi|قهوة|कॉफी|কফি|咖啡|کافی"],
  ["tea", "tea|thee|cha|teh|شاي|चाय|চা|茶|چائے"],
  ["pasta", "pasta|macaroni|spaghetti|noodle|noodles|noedels|pates|massa|mie|معكرونة|पास्ता|পাস্তা|意大利面|面条|پاستا"],
  ["rice", "rice|rijst|arroz|riz|beras|nasi|ارز|أرز|चावल|ভাত|চাল|米饭|大米|چاول"],
  ["grain", "oat|oats|oatmeal|haver|havermout|muesli|granola|wheat|tarwe|cereal|cereals|flour|meel|quinoa|barley|gerst|bulgur|couscous|cornflakes|avena|avoine|aveia|sereal|شوفان|जई|ওটস|燕麦|جئی"],
  ["nuts", "nut|nuts|seed|seeds|zaden|pecan|pecans|pistachio|pistachios|coconut|kokos|almond|almonds|amandel|amandelen|walnut|walnuts|peanut|peanuts|pinda|pindakaas|cashew|cashews|noot|noten|noix|amendoim|almendra|kacang|مكسرات|बादाम|বাদাম|坚果|بادام"],
  ["beans", "bean|beans|peas|pea|erwten|tofu|soybean|soybeans|sojabonen|bonen|boon|lentil|lentils|linzen|chickpea|chickpeas|kikkererwten|lentille|lentejas|feijao|garbanzo|عدس|चना|মসুর|鹰嘴豆|چنے"],
  ["potato", "potato|potatoes|aardappel|aardappelen|pomme de terre|pommes de terre|patata|patatas|batata|kentang|بطاطس|आलू|আলু|土豆|آلو"],
  ["pineapple", "pineapple|ananas|pina|nenas|أناناس|अनानास|আনারস|菠萝|انناس"],
  ["apple", "apple|apples|appel|appels|appelmoes|apfel|manzana|manzanas|pomme|pommes|maca|apel|تفاح|सेब|আপেল|苹果|سیب"],
  ["banana", "banana|bananas|banaan|bananen|banane|bananes|platano|pisang|موز|केला|কলা|香蕉|کیلا"],
  ["pear", "pear|pears|peer|peren|poire|pera|pir|كمثرى|नाशपाती|নাশপাতি|梨|ناشپاتی"],
  ["citrus", "orange|oranges|sinaasappel|sinaasappels|lemon|lemons|citroen|lime|limoen|mandarin|mandarijn|naranja|limon|citron|laranja|jeruk|برتقال|संतरा|কমলা|橙|لیموں"],
  ["berries", "strawberry|strawberries|aardbei|aardbeien|blueberry|blueberries|raspberry|raspberries|framboos|frambozen|berries|bessen|fraise|fresa|morango|stroberi|فراولة|स्ट्रॉबेरी|স্ট্রবেরি|草莓|اسٹرابیری"],
  ["melon", "melon|melons|meloen|watermelon|watermeloen|cantaloupe|casaba|بطيخ|तरबूज|তরমুজ|瓜|تربوز"],
  ["grapes", "grape|grapes|druif|druiven|raisin|raisins|rozijnen|raisin|uva|uvas|anggur|عنب|अंगूर|আঙুর|葡萄|انگور"],
  ["avocado", "avocado|avocados|avocado's|aguacate|abacate|alpukat|أفوكادو|एवोकाडो|অ্যাভোকাডো|牛油果|ایوکاڈو"],
  ["carrot", "carrot|carrots|wortel|wortelen|wortels|carotte|zanahoria|cenoura|wortel|جزر|गाजर|গাজর|胡萝卜|گاجر"],
  ["tomato", "tomato|tomatoes|tomaat|tomaten|tomate|tomat|طماطم|टमाटर|টমেটো|番茄|ٹماٹر"],
  ["vegetables", "vegetable|vegetables|groente|groenten|artichoke|artichokes|cauliflower|bloemkool|beet|beets|biet|bieten|celery|bleekselderij|broccoli|spinach|spinazie|lettuce|sla|onion|onions|ui|uien|garlic|knoflook|pepper|peppers|paprika|mushroom|mushrooms|champignon|champignons|asparagus|asperge|asperges|aubergine|eggplant|zucchini|courgette|cabbage|kool|cucumber|komkommer|salad|salade|legumes|verduras|sayur|خضار|पालक|শাক|蔬菜|سبزی"],
  ["egg", "egg|eggs|ei|eieren|huevo|huevos|oeuf|œuf|ovo|ovos|telur|بيض|अंडा|ডিম|鸡蛋|انڈا"],
  ["fish", "fish|vis|salmon|zalm|tuna|tonijn|cod|kabeljauw|pescado|poisson|peixe|ikan|سمك|मछली|মাছ|鱼|مچھلی"],
  ["poultry", "chicken|kip|kipfilet|kippenvlees|poultry|turkey|kalkoen|pollo|poulet|frango|ayam|دجاج|चिकन|মুরগি|鸡肉|مرغی"],
  ["meat", "meat|vlees|lamb|veal|game|lamsvlees|gehakt|hert|beef|rund|rundvlees|pork|varken|steak|bacon|ham|sausage|worst|carne|viande|daging|لحم|मांस|মাংস|肉|گوشت"],
  ["fruit", "fruit|fruits|vrucht|vruchten|cherry|cherries|kers|kersen|peach|peaches|perzik|perziken|plum|plums|pruim|pruimen|mango|mangos|kiwi|kiwis|apricot|apricots|abrikoos|abrikozen|nectarine|nectarines|fig|figs|vijg|vijgen|date|dates|dadel|dadels"],
  ["herbs", "herb|herbs|spice|spices|kruiden|basil|basilicum|parsley|peterselie|coriander|koriander|thyme|tijm|rosemary|rozemarijn|oregano|cinnamon|kaneel"],
  ["oil", "oil|olie|olive|olijf|aceite|huile|azeite|minyak|زيت|तेल|তেল|油|تیل"],
];

// Use a supplied catalogue category only when the product name is inconclusive.
// Category names never become paths or trigger a remote image request.
const categoryIcons: Record<string, string> = {
  "Baked Products": "bread", "Snacks": "biscuit", "Sweets": "sweets",
  "Vegetables and Vegetable Products": "vegetables", "Dairy and Egg Products": "milk",
  "Fats and Oils": "oil", "Breakfast Cereals": "grain",
  "Finfish and Shellfish Products": "fish", "Fruits and Fruit Juices": "fruit",
  "Legumes and Legume Products": "beans", "Sausages and Luncheon Meats": "meat",
  "Nut and Seed Products": "nuts", "Cereal Grains and Pasta": "grain",
  "Poultry Products": "poultry", "Spices and Herbs": "herbs",
  "Soups, Sauces, and Gravies": "soup", "Lamb, Veal, and Game Products": "meat",
  "Beef Products": "meat", "Pork Products": "meat", "Beverages": "drink",
};

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function foodIllustration(product: string, category?: string): string {
  const text = normalize(product);
  if (/\b(chocolate milk|chocolademelk|chocomel)\b/.test(text)) return "/images/food-illustrations/milk.svg";
  if (/\b(olive oil|vegetable oil|olijfolie|zonnebloemolie)\b/.test(text)) return "/images/food-illustrations/oil.svg";
  const words = new Set(text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []);
  for (const [image, aliases] of groups) {
    if (aliases.split("|").some(alias => {
      const name = normalize(alias);
      return /[\u3400-\u9fff]/.test(name) ? text.includes(name)
        : name.includes(" ") ? ` ${text} `.includes(` ${name} `) : words.has(name);
    })) return `/images/food-illustrations/${image}.svg`;
  }
  const categoryIcon = category && Object.hasOwn(categoryIcons, category) ? categoryIcons[category] : "meal";
  return `/images/food-illustrations/${categoryIcon}.svg`;
}
