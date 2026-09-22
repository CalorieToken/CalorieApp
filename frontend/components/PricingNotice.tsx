import policy from "../../contracts/pilot/v1/pricing.json";

const copy: Record<string, [string, string, string]> = {
  en: ["Free launch phase", "Available CalorieApp features are currently free: no subscription or CalorieApp transaction fee.", "External network or provider fees may still apply. Future paid features will need a new, explicit choice; there is no automatic paid conversion."],
  nl: ["Gratis startfase", "Beschikbare CalorieApp-functies zijn nu gratis: geen abonnement of CalorieApp-transactiekosten.", "Een netwerk of externe dienst kan wel kosten rekenen. Toekomstige betaalde functies vragen een nieuwe, bewuste keuze; niets wordt automatisch betaald."],
  "zh-Hans": ["免费起步阶段", "目前可用的 CalorieApp 功能免费：无订阅费或 CalorieApp 交易手续费。", "外部网络或服务商仍可能收费。将来的付费功能需要您重新明确选择，不会自动转为付费。"],
  hi: ["निःशुल्क शुरुआती चरण", "CalorieApp की उपलब्ध सुविधाएँ अभी निःशुल्क हैं: कोई सदस्यता या CalorieApp लेनदेन शुल्क नहीं।", "बाहरी नेटवर्क या प्रदाता शुल्क ले सकते हैं। भविष्य की सशुल्क सुविधाओं के लिए आपकी नई, स्पष्ट सहमति ज़रूरी होगी; अपने आप शुल्क नहीं लगेगा।"],
  es: ["Fase inicial gratuita", "Las funciones disponibles de CalorieApp son gratuitas por ahora: sin suscripción ni comisión de CalorieApp por transacción.", "Las redes o proveedores externos pueden cobrar. Las futuras funciones de pago requerirán una nueva elección expresa; no habrá conversión automática a pago."],
  ar: ["مرحلة إطلاق مجانية", "ميزات CalorieApp المتاحة مجانية حاليًا: لا اشتراك ولا رسوم معاملات من CalorieApp.", "قد تفرض الشبكات أو الجهات الخارجية رسومًا. تتطلب الميزات المدفوعة مستقبلًا اختيارًا جديدًا وصريحًا؛ لا يوجد انتقال تلقائي إلى الدفع."],
  fr: ["Phase de lancement gratuite", "Les fonctions disponibles de CalorieApp sont actuellement gratuites : sans abonnement ni frais de transaction CalorieApp.", "Des frais de réseau ou de prestataires externes peuvent s’appliquer. Les futures fonctions payantes nécessiteront un nouveau choix explicite ; aucun passage automatique au payant."],
  bn: ["বিনামূল্যের প্রাথমিক পর্যায়", "CalorieApp-এর উপলব্ধ সুবিধাগুলো এখন বিনামূল্যে: কোনো সাবস্ক্রিপশন বা CalorieApp লেনদেন ফি নেই।", "বাইরের নেটওয়ার্ক বা সেবাদাতা ফি নিতে পারে। ভবিষ্যতের সশুল্ক সুবিধার জন্য নতুন করে আপনার স্পষ্ট সম্মতি লাগবে; স্বয়ংক্রিয়ভাবে টাকা নেওয়া হবে না।"],
  pt: ["Fase inicial gratuita", "As funções disponíveis do CalorieApp são gratuitas neste momento: sem assinatura ou taxa de transação do CalorieApp.", "Redes ou fornecedores externos podem cobrar taxas. As futuras funções pagas exigirão uma nova escolha explícita; não haverá conversão automática para pagamento."],
  id: ["Tahap awal gratis", "Fitur CalorieApp yang tersedia saat ini gratis: tanpa langganan atau biaya transaksi CalorieApp.", "Jaringan atau penyedia eksternal dapat mengenakan biaya. Fitur berbayar di masa mendatang memerlukan pilihan baru yang tegas; tidak ada peralihan otomatis ke layanan berbayar."],
  ur: ["مفت ابتدائی مرحلہ", "CalorieApp کی دستیاب خصوصیات فی الحال مفت ہیں: کوئی سبسکرپشن یا CalorieApp لین دین فیس نہیں۔", "بیرونی نیٹ ورک یا سروس فراہم کنندہ فیس لے سکتے ہیں۔ آئندہ بامعاوضہ خصوصیات کے لیے آپ کا نیا، واضح انتخاب ضروری ہوگا؛ خودکار ادائیگی شروع نہیں ہوگی۔"],
};

export function PricingNotice({locale}: {locale: string}) {
  const text = copy[locale] ?? copy.en;
  // This notice must never falsely describe a paid policy as free.
  if (policy.billing_enabled || policy.mode !== "free-launch" || policy.platform_transaction_fee_bps !== 0 || policy.subscription_price_minor !== 0 || policy.platform_transaction_fee_fixed !== "0" || policy.current_features_paywalled || policy.automatic_renewal) return null;
  return <details className="rounded-xl border border-brand-secondary/20 bg-white px-4 py-2 text-sm text-brand-primary" data-pricing-policy={policy.version}>
    <summary className="min-h-11 cursor-pointer content-center font-bold"><span aria-hidden="true">◇ </span>{text[0]}</summary>
    <p className="mb-2">{text[1]}</p><p className="mb-2 text-xs text-brand-secondary">{text[2]}</p>
  </details>;
}
