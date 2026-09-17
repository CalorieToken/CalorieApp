export const AGE_BAND_MESSAGE = "calorieapp:age-band";
export const AGE_BAND_REQUEST_MESSAGE = "calorieapp:age-band:request";
export const AGE_BAND_STORAGE_KEY = "calorieapp.age-band.v1";

export type AgeBand = "child" | "teen" | "adult";

const SUPPORTED = new Set<AgeBand>(["child", "teen", "adult"]);

type AgeCopy = {
  title: string;
  intro: string;
  privacy: string;
  child: string;
  childNote: string;
  teen: string;
  teenNote: string;
  adult: string;
  adultNote: string;
  current: string;
  change: string;
  close: string;
  limited: string;
  full: string;
};

const COPY: Record<string, AgeCopy> = {
  en: {title:"Choose your age group",intro:"This shows an age-appropriate version of CalorieApp.",privacy:"We do not ask for your birth date. This choice is kept only for this browser tab and is not proof of age.",child:"Child · 0–12",childNote:"Public food search and simple nutrition information.",teen:"Young person · 13–17",teenNote:"Public food search and nutrition information, without wallet or personal diary.",adult:"Adult · 18+",adultNote:"All available app features.",current:"Age experience",change:"Change age group",close:"Close",limited:"Public nutrition tools are available. Wallet login, transactions and the personal diary are not shown.",full:"All available app features are shown."},
  nl: {title:"Kies je leeftijdsgroep",intro:"Zo tonen we een passende versie van CalorieApp.",privacy:"We vragen niet om je geboortedatum. Deze keuze blijft alleen in dit browsertabblad staan en is geen bewijs van leeftijd.",child:"Kind · 0–12",childNote:"Openbaar eten zoeken en eenvoudige voedingsinformatie.",teen:"Jongere · 13–17",teenNote:"Openbaar eten zoeken en voedingsinformatie, zonder wallet of persoonlijk dagboek.",adult:"Volwassene · 18+",adultNote:"Alle beschikbare appfuncties.",current:"Leeftijdsomgeving",change:"Leeftijdsgroep wijzigen",close:"Sluiten",limited:"Openbare voedingstools blijven beschikbaar. Wallet-login, transacties en het persoonlijke dagboek worden niet getoond.",full:"Alle beschikbare appfuncties worden getoond."},
  "zh-Hans": {title:"选择年龄组",intro:"我们会显示适合相应年龄的 CalorieApp 版本。",privacy:"我们不会询问出生日期。此选择只保留在当前浏览器标签页中，不能作为年龄证明。",child:"儿童 · 0–12",childNote:"公开食品搜索和简单营养信息。",teen:"青少年 · 13–17",teenNote:"公开食品搜索和营养信息，不显示钱包或个人日记。",adult:"成人 · 18+",adultNote:"所有可用的应用功能。",current:"年龄模式",change:"更改年龄组",close:"关闭",limited:"可以使用公开营养工具。不显示钱包登录、交易和个人日记。",full:"显示所有可用的应用功能。"},
  hi: {title:"अपना आयु समूह चुनें",intro:"इससे CalorieApp का आयु के अनुसार उपयुक्त रूप दिखता है।",privacy:"हम जन्मतिथि नहीं पूछते। यह चुनाव केवल इस ब्राउज़र टैब में रहता है और आयु का प्रमाण नहीं है।",child:"बच्चा · 0–12",childNote:"सार्वजनिक भोजन खोज और सरल पोषण जानकारी।",teen:"किशोर · 13–17",teenNote:"सार्वजनिक भोजन खोज और पोषण जानकारी, वॉलेट या निजी डायरी के बिना।",adult:"वयस्क · 18+",adultNote:"सभी उपलब्ध ऐप सुविधाएँ।",current:"आयु अनुभव",change:"आयु समूह बदलें",close:"बंद करें",limited:"सार्वजनिक पोषण टूल उपलब्ध हैं। वॉलेट लॉगिन, लेन-देन और निजी डायरी नहीं दिखते।",full:"सभी उपलब्ध ऐप सुविधाएँ दिखाई जाती हैं।"},
  es: {title:"Elige tu grupo de edad",intro:"Así mostramos una versión de CalorieApp adecuada para la edad.",privacy:"No pedimos tu fecha de nacimiento. La elección solo dura en esta pestaña y no demuestra la edad.",child:"Niño/a · 0–12",childNote:"Búsqueda pública de alimentos e información nutricional sencilla.",teen:"Joven · 13–17",teenNote:"Búsqueda pública e información nutricional, sin cartera ni diario personal.",adult:"Adulto/a · 18+",adultNote:"Todas las funciones disponibles.",current:"Experiencia por edad",change:"Cambiar grupo de edad",close:"Cerrar",limited:"Las herramientas públicas de nutrición están disponibles. No se muestran inicio de cartera, transacciones ni diario personal.",full:"Se muestran todas las funciones disponibles."},
  ar: {title:"اختر فئتك العمرية",intro:"نعرض بذلك نسخة من CalorieApp مناسبة للعمر.",privacy:"لا نطلب تاريخ الميلاد. يبقى الاختيار في علامة التبويب هذه فقط ولا يُعد إثباتًا للعمر.",child:"طفل · 0–12",childNote:"بحث عام عن الطعام ومعلومات غذائية مبسطة.",teen:"يافع · 13–17",teenNote:"بحث عام ومعلومات غذائية من دون محفظة أو يوميات شخصية.",adult:"بالغ · 18+",adultNote:"كل ميزات التطبيق المتاحة.",current:"تجربة العمر",change:"تغيير الفئة العمرية",close:"إغلاق",limited:"أدوات التغذية العامة متاحة. لا يظهر تسجيل دخول المحفظة أو المعاملات أو اليوميات الشخصية.",full:"تظهر جميع ميزات التطبيق المتاحة."},
  fr: {title:"Choisissez votre tranche d’âge",intro:"Nous affichons ainsi une version de CalorieApp adaptée à l’âge.",privacy:"Nous ne demandons pas la date de naissance. Ce choix reste dans cet onglet et ne constitue pas une preuve d’âge.",child:"Enfant · 0–12",childNote:"Recherche publique d’aliments et informations nutritionnelles simples.",teen:"Jeune · 13–17",teenNote:"Recherche publique et informations nutritionnelles, sans portefeuille ni journal personnel.",adult:"Adulte · 18+",adultNote:"Toutes les fonctions disponibles.",current:"Expérience selon l’âge",change:"Changer de tranche d’âge",close:"Fermer",limited:"Les outils nutritionnels publics restent disponibles. La connexion au portefeuille, les transactions et le journal personnel ne sont pas affichés.",full:"Toutes les fonctions disponibles sont affichées."},
  bn: {title:"আপনার বয়সের বিভাগ বেছে নিন",intro:"এতে CalorieApp-এর বয়স-উপযোগী সংস্করণ দেখানো হয়।",privacy:"আমরা জন্মতারিখ চাই না। পছন্দটি শুধু এই ব্রাউজার ট্যাবে থাকে এবং এটি বয়সের প্রমাণ নয়।",child:"শিশু · 0–12",childNote:"সর্বজনীন খাবার খোঁজা ও সহজ পুষ্টি তথ্য।",teen:"কিশোর-কিশোরী · 13–17",teenNote:"সর্বজনীন খাবার খোঁজা ও পুষ্টি তথ্য, ওয়ালেট বা ব্যক্তিগত ডায়েরি ছাড়া।",adult:"প্রাপ্তবয়স্ক · 18+",adultNote:"সব উপলভ্য অ্যাপ সুবিধা।",current:"বয়সের অভিজ্ঞতা",change:"বয়সের বিভাগ বদলান",close:"বন্ধ করুন",limited:"সর্বজনীন পুষ্টি টুল পাওয়া যায়। ওয়ালেট লগইন, লেনদেন ও ব্যক্তিগত ডায়েরি দেখানো হয় না।",full:"সব উপলভ্য অ্যাপ সুবিধা দেখানো হয়।"},
  pt: {title:"Escolha a sua faixa etária",intro:"Assim mostramos uma versão da CalorieApp adequada à idade.",privacy:"Não pedimos a data de nascimento. A escolha fica apenas neste separador e não comprova a idade.",child:"Criança · 0–12",childNote:"Pesquisa pública de alimentos e informação nutricional simples.",teen:"Jovem · 13–17",teenNote:"Pesquisa pública e informação nutricional, sem carteira ou diário pessoal.",adult:"Adulto · 18+",adultNote:"Todas as funcionalidades disponíveis.",current:"Experiência por idade",change:"Alterar faixa etária",close:"Fechar",limited:"As ferramentas públicas de nutrição estão disponíveis. O login da carteira, as transações e o diário pessoal não são mostrados.",full:"Todas as funcionalidades disponíveis são mostradas."},
  id: {title:"Pilih kelompok usia",intro:"Ini menampilkan versi CalorieApp yang sesuai usia.",privacy:"Kami tidak meminta tanggal lahir. Pilihan hanya disimpan di tab browser ini dan bukan bukti usia.",child:"Anak · 0–12",childNote:"Pencarian makanan publik dan informasi gizi sederhana.",teen:"Remaja · 13–17",teenNote:"Pencarian publik dan informasi gizi, tanpa dompet atau catatan pribadi.",adult:"Dewasa · 18+",adultNote:"Semua fitur aplikasi yang tersedia.",current:"Pengalaman usia",change:"Ubah kelompok usia",close:"Tutup",limited:"Alat gizi publik tersedia. Login dompet, transaksi, dan catatan pribadi tidak ditampilkan.",full:"Semua fitur aplikasi yang tersedia ditampilkan."},
  ur: {title:"اپنی عمر کا گروپ منتخب کریں",intro:"اس سے CalorieApp کا عمر کے مطابق موزوں ورژن دکھایا جاتا ہے۔",privacy:"ہم تاریخ پیدائش نہیں پوچھتے۔ یہ انتخاب صرف اس براؤزر ٹیب میں رہتا ہے اور عمر کا ثبوت نہیں ہے۔",child:"بچہ · 0–12",childNote:"عوامی خوراک تلاش اور سادہ غذائی معلومات۔",teen:"نوجوان · 13–17",teenNote:"عوامی خوراک تلاش اور غذائی معلومات، والٹ یا ذاتی ڈائری کے بغیر۔",adult:"بالغ · 18+",adultNote:"ایپ کی تمام دستیاب خصوصیات۔",current:"عمر کا تجربہ",change:"عمر کا گروپ بدلیں",close:"بند کریں",limited:"عوامی غذائی ٹول دستیاب ہیں۔ والٹ لاگ اِن، لین دین اور ذاتی ڈائری نہیں دکھائی جاتی۔",full:"ایپ کی تمام دستیاب خصوصیات دکھائی جاتی ہیں۔"},
};

export function isAgeBand(value: unknown): value is AgeBand {
  return typeof value === "string" && SUPPORTED.has(value as AgeBand);
}

export function ageExperienceCopy(locale: string): {locale: string; direction: "ltr" | "rtl"; copy: AgeCopy} {
  const normalized = /^zh(?:-|$)/i.test(locale) ? "zh-Hans" : locale.split("-")[0];
  const tag = Object.hasOwn(COPY, normalized) ? normalized : "en";
  return {locale: tag, direction: tag === "ar" || tag === "ur" ? "rtl" : "ltr", copy: COPY[tag]};
}

export function readSessionAgeBand(): AgeBand | null {
  try {
    const value = window.sessionStorage.getItem(AGE_BAND_STORAGE_KEY);
    return isAgeBand(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeSessionAgeBand(value: AgeBand | null): void {
  try {
    if (value) window.sessionStorage.setItem(AGE_BAND_STORAGE_KEY, value);
    else window.sessionStorage.removeItem(AGE_BAND_STORAGE_KEY);
  } catch { /* A blocked storage API must not block the age-appropriate view. */ }
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

export function ageBandFromParent(event: MessageEvent<unknown>): AgeBand | null {
  const origin = trustedWordPressParentOrigin();
  if (!origin || event.origin !== origin || event.source !== window.parent ||
      !event.data || typeof event.data !== "object" || Array.isArray(event.data)) return null;
  const data = event.data as Record<string, unknown>;
  return data.type === AGE_BAND_MESSAGE && data.version === 1 && isAgeBand(data.band)
    ? data.band : null;
}

export function requestAgeBandFromParent(): boolean {
  const origin = trustedWordPressParentOrigin();
  if (!origin) return false;
  window.parent.postMessage({type: AGE_BAND_REQUEST_MESSAGE, version: 1}, origin);
  return true;
}

export function postAgeBandToParent(band: AgeBand): boolean {
  const origin = trustedWordPressParentOrigin();
  if (!origin) return false;
  window.parent.postMessage({type: AGE_BAND_MESSAGE, version: 1, band}, origin);
  return true;
}
