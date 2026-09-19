/* Private aggregate product-grade summary beside the CalorieApp frame. GPL-2.0-or-later. */
(function(){'use strict';
  var allowedOrigins=['https://app.calorietoken.net','https://calorieapp-frontend.onrender.com'];
  var periods=['day','week','month','all'];
  var labels={
    en:{title:'Your food log at a glance',scope:'Aggregate counts only; product details stay inside CalorieApp.',periodTitle:'Period',day:'Today',week:'This week',month:'This month',all:'All',loading:'Updating this overview…',unavailable:'This overview is temporarily unavailable.',details:'Sources and explanation',coverage:'OFF Nutri-Score supplied: {known} of {off} OFF products.',empty:'No OFF product Nutri-Score is available for this period.',off:'Open Food Facts',usda:'USDA',other:'Other / unknown',note:'All sources count in app nutrient totals. A–E applies only to source-supplied OFF product grades.'},
    nl:{title:'Je eetdagboek in één oogopslag',scope:'Alleen totalen; productdetails blijven in CalorieApp.',periodTitle:'Periode',day:'Vandaag',week:'Deze week',month:'Deze maand',all:'Alles',loading:'Overzicht wordt bijgewerkt…',unavailable:'Dit overzicht is tijdelijk niet beschikbaar.',details:'Bronnen en uitleg',coverage:'OFF Nutri-Score aangeleverd: {known} van {off} OFF-producten.',empty:'Voor deze periode is geen Nutri-Score van een OFF-product beschikbaar.',off:'Open Food Facts',usda:'USDA',other:'Overig / onbekend',note:'Alle bronnen tellen mee in de voedingstotalen van de app. A–E geldt alleen voor door OFF aangeleverde productscores.'},
    'zh-Hans':{title:'饮食记录概览',scope:'仅显示汇总；产品详情保留在 CalorieApp 中。',periodTitle:'时段',day:'今天',week:'本周',month:'本月',all:'全部',loading:'正在更新概览…',unavailable:'此概览暂时不可用。',details:'来源与说明',coverage:'OFF 提供的 Nutri-Score：{known}/{off} 个 OFF 产品。',empty:'此时段没有可用的 OFF 产品 Nutri-Score。',off:'Open Food Facts',usda:'USDA',other:'其他',note:'所有来源都计入应用的营养总量。A–E 仅适用于 OFF 来源提供的产品等级。'},
    hi:{title:'आपकी भोजन डायरी एक नज़र में',scope:'केवल कुल आँकड़े; उत्पाद विवरण CalorieApp में रहते हैं।',periodTitle:'अवधि',day:'आज',week:'यह सप्ताह',month:'यह महीना',all:'सभी',loading:'सारांश अपडेट हो रहा है…',unavailable:'सारांश अभी उपलब्ध नहीं है।',details:'स्रोत और विवरण',coverage:'OFF Nutri-Score उपलब्ध: {off} OFF उत्पादों में से {known}।',empty:'इस अवधि के लिए कोई OFF उत्पाद Nutri-Score उपलब्ध नहीं है।',off:'Open Food Facts',usda:'USDA',other:'अन्य',note:'सभी स्रोत ऐप के पोषण योग में शामिल हैं। A–E केवल OFF द्वारा दिए उत्पाद ग्रेड पर लागू है।'},
    es:{title:'Tu diario de un vistazo',scope:'Solo totales; los detalles de productos permanecen en CalorieApp.',periodTitle:'Período',day:'Hoy',week:'Esta semana',month:'Este mes',all:'Todo',loading:'Actualizando el resumen…',unavailable:'El resumen no está disponible temporalmente.',details:'Fuentes y explicación',coverage:'Nutri-Score de OFF: {known} de {off} productos OFF.',empty:'No hay ningún Nutri-Score de producto OFF disponible en este período.',off:'Open Food Facts',usda:'USDA',other:'Otra',note:'Todas las fuentes cuentan en los totales nutricionales de la app. A–E solo se aplica a clasificaciones de producto proporcionadas por OFF.'},
    ar:{title:'سجل طعامك في لمحة',scope:'الإجماليات فقط؛ تبقى تفاصيل المنتجات داخل CalorieApp.',periodTitle:'الفترة',day:'اليوم',week:'هذا الأسبوع',month:'هذا الشهر',all:'الكل',loading:'جارٍ تحديث الملخص…',unavailable:'الملخص غير متاح مؤقتًا.',details:'المصادر والشرح',coverage:'Nutri-Score من OFF: ‏{known} من {off} من منتجات OFF.',empty:'لا تتوفر درجة Nutri-Score لمنتج OFF في هذه الفترة.',off:'Open Food Facts',usda:'USDA',other:'أخرى',note:'تدخل كل المصادر في مجاميع العناصر الغذائية داخل التطبيق. تنطبق A–E فقط على درجات المنتجات التي يوفرها OFF.'},
    fr:{title:'Votre journal en un coup d’œil',scope:'Totaux uniquement ; les détails restent dans CalorieApp.',periodTitle:'Période',day:'Aujourd’hui',week:'Cette semaine',month:'Ce mois',all:'Tout',loading:'Mise à jour du résumé…',unavailable:'Ce résumé est temporairement indisponible.',details:'Sources et explication',coverage:'Nutri-Score OFF fourni : {known} sur {off} produits OFF.',empty:'Aucun Nutri-Score de produit OFF n’est disponible pour cette période.',off:'Open Food Facts',usda:'USDA',other:'Autre',note:'Toutes les sources comptent dans les totaux nutritionnels de l’app. A–E concerne uniquement les classes de produit fournies par OFF.'},
    bn:{title:'এক নজরে আপনার খাবারের ডায়েরি',scope:'শুধু মোট সংখ্যা; পণ্যের বিস্তারিত CalorieApp-এ থাকে।',periodTitle:'সময়কাল',day:'আজ',week:'এই সপ্তাহ',month:'এই মাস',all:'সব',loading:'সারাংশ আপডেট হচ্ছে…',unavailable:'সারাংশটি সাময়িকভাবে পাওয়া যাচ্ছে না।',details:'উৎস ও ব্যাখ্যা',coverage:'OFF Nutri-Score আছে: {off}টি OFF পণ্যের মধ্যে {known}টি।',empty:'এই সময়ে কোনো OFF পণ্যের Nutri-Score নেই।',off:'Open Food Facts',usda:'USDA',other:'অন্যান্য',note:'সব উৎস অ্যাপের পুষ্টির মোট হিসাবে ধরা হয়। A–E শুধু OFF-এর দেওয়া পণ্যের গ্রেডে প্রযোজ্য।'},
    pt:{title:'Seu diário num relance',scope:'Apenas totais; os detalhes ficam no CalorieApp.',periodTitle:'Período',day:'Hoje',week:'Esta semana',month:'Este mês',all:'Tudo',loading:'Atualizando o resumo…',unavailable:'Este resumo está temporariamente indisponível.',details:'Fontes e explicação',coverage:'Nutri-Score OFF fornecido: {known} de {off} produtos OFF.',empty:'Não há Nutri-Score de produto OFF disponível neste período.',off:'Open Food Facts',usda:'USDA',other:'Outra',note:'Todas as fontes contam nos totais nutricionais da app. A–E aplica-se apenas às classificações de produto fornecidas pelo OFF.'},
    id:{title:'Catatan makananmu sekilas',scope:'Hanya total; detail produk tetap di CalorieApp.',periodTitle:'Periode',day:'Hari ini',week:'Minggu ini',month:'Bulan ini',all:'Semua',loading:'Memperbarui ringkasan…',unavailable:'Ringkasan ini sementara tidak tersedia.',details:'Sumber dan penjelasan',coverage:'Nutri-Score OFF tersedia: {known} dari {off} produk OFF.',empty:'Tidak ada Nutri-Score produk OFF untuk periode ini.',off:'Open Food Facts',usda:'USDA',other:'Lainnya',note:'Semua sumber masuk dalam total gizi aplikasi. A–E hanya berlaku untuk peringkat produk dari OFF.'},
    ur:{title:'آپ کی خوراک کی ڈائری ایک نظر میں',scope:'صرف مجموعے؛ مصنوعات کی تفصیل CalorieApp میں رہتی ہے۔',periodTitle:'مدت',day:'آج',week:'یہ ہفتہ',month:'یہ مہینہ',all:'سب',loading:'خلاصہ اپ ڈیٹ ہو رہا ہے…',unavailable:'خلاصہ عارضی طور پر دستیاب نہیں۔',details:'ذرائع اور وضاحت',coverage:'OFF Nutri-Score دستیاب: {off} OFF پروڈکٹس میں سے {known}۔',empty:'اس مدت کے لیے کسی OFF پروڈکٹ کا Nutri-Score دستیاب نہیں۔',off:'Open Food Facts',usda:'USDA',other:'دیگر',note:'تمام ذرائع ایپ کے غذائی مجموعوں میں شامل ہیں۔ A–E صرف OFF کے فراہم کردہ پروڈکٹ گریڈز پر لاگو ہے۔'}
  };
  var plainLabels={
    en:{scope:'Your entries and available product scores for this period.',logged:'{total} entries logged',loggedOne:'1 entry logged',empty:'Nothing logged in this period yet.',noGrades:'Logged, but no Nutri-Score available.',coverage:'Nutri-Score available for {known} of {total} entries.',partial:'Without a score: {unscored}. These entries still count in your diary.',gradeTitle:'Product score distribution',explanation:'The bar shows supplied product scores, not a score for your overall diet. Missing scores do not mean unhealthy. USDA entries have no Nutri-Score here.'},
    nl:{scope:'Je registraties en beschikbare productscores voor deze periode.',logged:'{total} registraties gelogd',loggedOne:'1 registratie gelogd',empty:'Nog niets gelogd in deze periode.',noGrades:'Wel gelogd, geen Nutri-Score beschikbaar.',coverage:'Nutri-Score beschikbaar voor {known} van {total} registraties.',partial:'Zonder score: {unscored}. Deze registraties tellen wel mee in je dagboek.',gradeTitle:'Verdeling van productscores',explanation:'De balk toont aangeleverde productscores, geen score voor je totale eetpatroon. Geen score betekent niet ongezond. USDA-registraties hebben hier geen Nutri-Score.'},
    'zh-Hans':{scope:'所选时段的饮食记录和可用产品评分。',logged:'已记录 {total} 条',loggedOne:'已记录 1 条',empty:'此时段暂无记录。',noGrades:'已有记录，但暂无 Nutri-Score。',coverage:'{total} 条记录中有 {known} 条提供 Nutri-Score。',partial:'无评分：{unscored} 条。这些记录仍计入饮食日记。',gradeTitle:'产品评分分布',explanation:'此图显示来源提供的产品评分，不代表整体饮食评分。缺少评分不等于不健康。USDA 记录在此不提供 Nutri-Score。'},
    hi:{scope:'इस अवधि की प्रविष्टियाँ और उपलब्ध उत्पाद स्कोर।',logged:'{total} प्रविष्टियाँ दर्ज',loggedOne:'1 प्रविष्टि दर्ज',empty:'इस अवधि में अभी कुछ दर्ज नहीं है।',noGrades:'भोजन दर्ज है, लेकिन Nutri-Score उपलब्ध नहीं है।',coverage:'{total} में से {known} प्रविष्टियों का Nutri-Score उपलब्ध है।',partial:'बिना स्कोर: {unscored}। ये प्रविष्टियाँ डायरी में गिनी जाती हैं।',gradeTitle:'उत्पाद स्कोर का वितरण',explanation:'यह पट्टी स्रोत से मिले उत्पाद स्कोर दिखाती है, पूरे आहार का स्कोर नहीं। स्कोर न होने का अर्थ अस्वस्थ नहीं है। USDA प्रविष्टियों का यहाँ Nutri-Score नहीं है।'},
    es:{scope:'Tus registros y las puntuaciones disponibles de este período.',logged:'{total} registros guardados',loggedOne:'1 registro guardado',empty:'Aún no hay registros en este período.',noGrades:'Hay registros, pero no hay Nutri-Score disponible.',coverage:'Nutri-Score disponible para {known} de {total} registros.',partial:'Sin puntuación: {unscored}. Siguen contando en tu diario.',gradeTitle:'Distribución de puntuaciones',explanation:'La barra muestra puntuaciones de productos de la fuente, no de tu dieta completa. Sin puntuación no significa poco saludable. Aquí los registros USDA no tienen Nutri-Score.'},
    ar:{scope:'سجلاتك وتقييمات المنتجات المتاحة لهذه الفترة.',logged:'عدد السجلات: {total}',loggedOne:'سجل واحد محفوظ',empty:'لم تسجل طعامًا في هذه الفترة بعد.',noGrades:'توجد سجلات، لكن Nutri-Score غير متاح.',coverage:'يتوفر Nutri-Score لعدد {known} من أصل {total} سجلًا.',partial:'دون تقييم: {unscored}. تظل هذه السجلات محسوبة في يومياتك.',gradeTitle:'توزيع تقييمات المنتجات',explanation:'يعرض الشريط تقييمات المنتجات المقدمة من المصدر، وليس تقييمًا لنظامك الغذائي كاملًا. غياب التقييم لا يعني أن المنتج غير صحي. سجلات USDA لا تتضمن Nutri-Score هنا.'},
    fr:{scope:'Vos enregistrements et les scores disponibles pour cette période.',logged:'{total} entrées enregistrées',loggedOne:'1 entrée enregistrée',empty:'Aucun aliment enregistré pour cette période.',noGrades:'Aliments enregistrés, mais aucun Nutri-Score disponible.',coverage:'Nutri-Score disponible pour {known} entrées sur {total}.',partial:'Sans score : {unscored}. Ces entrées comptent toujours dans votre journal.',gradeTitle:'Répartition des scores des produits',explanation:'La barre montre les scores produits fournis par la source, pas un score de votre alimentation globale. L’absence de score ne signifie pas malsain. Les entrées USDA n’ont pas de Nutri-Score ici.'},
    bn:{scope:'এই সময়ের নথিভুক্ত খাবার ও উপলব্ধ পণ্যের স্কোর।',logged:'{total}টি খাবার নথিভুক্ত',loggedOne:'১টি খাবার নথিভুক্ত',empty:'এই সময়ে এখনও কিছু নথিভুক্ত হয়নি।',noGrades:'খাবার নথিভুক্ত আছে, তবে Nutri-Score নেই।',coverage:'{total}টির মধ্যে {known}টির Nutri-Score আছে।',partial:'স্কোর ছাড়া: {unscored}টি। এগুলোও ডায়েরিতে গণনা হয়।',gradeTitle:'পণ্যের স্কোরের বণ্টন',explanation:'বারটি উৎসের দেওয়া পণ্যের স্কোর দেখায়, সম্পূর্ণ খাদ্যাভ্যাসের স্কোর নয়। স্কোর না থাকা মানেই অস্বাস্থ্যকর নয়। USDA খাবারের এখানে Nutri-Score নেই।'},
    pt:{scope:'Seus registros e as pontuações disponíveis neste período.',logged:'{total} registros salvos',loggedOne:'1 registro salvo',empty:'Ainda não há registros neste período.',noGrades:'Há registros, mas não há Nutri-Score disponível.',coverage:'Nutri-Score disponível para {known} de {total} registros.',partial:'Sem pontuação: {unscored}. Esses registros continuam no diário.',gradeTitle:'Distribuição das pontuações',explanation:'A barra mostra pontuações de produtos fornecidas pela fonte, não uma pontuação da dieta completa. Sem pontuação não significa pouco saudável. Registros USDA não têm Nutri-Score aqui.'},
    id:{scope:'Catatan dan skor produk yang tersedia untuk periode ini.',logged:'{total} catatan tersimpan',loggedOne:'1 catatan tersimpan',empty:'Belum ada makanan tercatat pada periode ini.',noGrades:'Makanan tercatat, tetapi Nutri-Score tidak tersedia.',coverage:'Nutri-Score tersedia untuk {known} dari {total} catatan.',partial:'Tanpa skor: {unscored}. Catatan ini tetap dihitung dalam buku harian.',gradeTitle:'Sebaran skor produk',explanation:'Batang ini menampilkan skor produk dari sumber, bukan skor seluruh pola makan. Tanpa skor bukan berarti tidak sehat. Catatan USDA tidak memiliki Nutri-Score di sini.'},
    ur:{scope:'اس مدت کے اندراجات اور دستیاب مصنوعات کے اسکور۔',logged:'{total} اندراجات محفوظ',loggedOne:'۱ اندراج محفوظ',empty:'اس مدت میں ابھی کچھ درج نہیں ہوا۔',noGrades:'خوراک درج ہے، مگر Nutri-Score دستیاب نہیں۔',coverage:'{total} میں سے {known} اندراجات کا Nutri-Score دستیاب ہے۔',partial:'بغیر اسکور: {unscored}۔ یہ اندراجات بھی ڈائری میں شمار ہوتے ہیں۔',gradeTitle:'مصنوعات کے اسکور کی تقسیم',explanation:'یہ پٹی ماخذ کے فراہم کردہ مصنوعات کے اسکور دکھاتی ہے، مکمل غذا کا اسکور نہیں۔ اسکور نہ ہونے کا مطلب غیر صحت بخش نہیں۔ USDA اندراجات کا یہاں Nutri-Score نہیں ہوتا۔'}
  };
  Object.keys(plainLabels).forEach(function(tag){Object.assign(labels[tag],plainLabels[tag]);});
  var node=null,summary=null,state='hidden',selectedPeriod='day';
  function pagePath(){return window.location.pathname.replace(/^\/index\.php(?=\/|$)/,'').replace(/\/+$/,'')||'/';}
  function isCalorieAppPage(){return document.body.classList.contains('page-id-7880')||pagePath()==='/calorieapp';}
  function locale(preferred){
    var picker=document.querySelector('#ctstyle-language-select,#ctstyle-account-language');
    var value=typeof preferred==='string'&&preferred||picker&&picker.value||document.documentElement.lang||'en';
    if(/^zh(?:-|$)/i.test(value))return 'zh-Hans';
    value=value.split('-')[0];return labels[value]?value:'en';
  }
  function copy(preferred){return labels[locale(preferred)]||labels.en;}
  function validPeriod(value){return periods.indexOf(value)>=0?value:null;}
  function eligibleFrame(){
    var frames=Array.from(document.querySelectorAll('iframe[title="CalorieApp"]')).filter(function(frame){
      try{return allowedOrigins.includes(new URL(frame.src,window.location.href).origin);}catch(_){return false;}
    });
    return frames.length===1?frames[0]:null;
  }
  function targetOrigin(frame){try{var origin=new URL(frame.src,window.location.href).origin;return allowedOrigins.includes(origin)?origin:null;}catch(_){return null;}}
  function normaliseNutrition(data){
    if(!data||data.type!=='calorieapp:nutrition-summary'||data.version!==1||data.status!=='ready'||!validPeriod(data.period))return null;
    var total=data.total,known=data.known,missing=data.missing,counts=data.counts,sources=data.sources,limit=100000;
    function count(value){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=limit;}
    if(!count(total)||!count(known)||!count(missing)||!counts||typeof counts!=='object'||Array.isArray(counts)||!sources||typeof sources!=='object'||Array.isArray(sources))return null;
    var grades=['A','B','C','D','E'],sum=0,safe={};
    for(var i=0;i<grades.length;i++){var grade=grades[i],value=counts[grade];if(!count(value))return null;safe[grade]=value;sum+=value;}
    var sourceKeys=['open_food_facts','usda','other'],sourceTotal=0,safeSources={};
    for(var j=0;j<sourceKeys.length;j++){var key=sourceKeys[j],sourceCount=sources[key];if(!count(sourceCount))return null;safeSources[key]=sourceCount;sourceTotal+=sourceCount;}
    if(sum!==known||known+missing!==safeSources.open_food_facts||sourceTotal!==total)return null;
    return {locale:locale(data.locale),period:data.period,total:total,known:known,missing:missing,counts:safe,sources:safeSources};
  }
  function format(template,values){return template.replace(/\{(known|off|total|unscored)\}/g,function(_,key){return values[key];});}
  function render(preferred){
    if(!node)return;
    if(state==='hidden'){node.hidden=true;return;}
    var tag=locale(preferred||(summary&&summary.locale)),c=copy(tag),number=new Intl.NumberFormat(tag);
    node.lang=tag;node.dir=tag==='ar'||tag==='ur'?'rtl':'ltr';node.hidden=false;node.dataset.state=state;node.setAttribute('aria-label',c.title);
    node.querySelector('.ct-calorieapp-nutrition-title').textContent=c.title;
    node.querySelector('.ct-calorieapp-nutrition-scope').textContent=c.scope;
    var controls=node.querySelector('.ct-calorieapp-nutrition-periods');controls.setAttribute('aria-label',c.periodTitle);
    periods.forEach(function(value){var button=controls.querySelector('[data-ct-nutrition-period="'+value+'"]');button.textContent=c[value];button.setAttribute('aria-pressed',String(selectedPeriod===value));});
    var status=node.querySelector('.ct-calorieapp-nutrition-status');status.hidden=state==='ready';status.textContent=state==='loading'?c.loading:c.unavailable;
    var body=node.querySelector('.ct-calorieapp-nutrition-body');body.hidden=state!=='ready';
    node.querySelector('.ct-calorieapp-nutrition-details-label').textContent=c.details;
    node.querySelector('.ct-calorieapp-nutrition-note').textContent=c.explanation;
    if(!summary||state!=='ready')return;
    var values={known:number.format(summary.known),off:number.format(summary.sources.open_food_facts),total:number.format(summary.total),unscored:number.format(summary.total-summary.known)};
    node.querySelector('.ct-calorieapp-nutrition-logged').textContent=summary.total===1?c.loggedOne:format(c.logged,values);
    node.querySelector('.ct-calorieapp-nutrition-coverage').textContent=!summary.total?c.empty:!summary.known?c.noGrades:format(c.coverage,values);
    var partial=node.querySelector('.ct-calorieapp-nutrition-partial');partial.hidden=!summary.total||summary.known===summary.total;partial.textContent=format(c.partial,values);
    var gradeTitle=node.querySelector('.ct-calorieapp-nutrition-grade-title');gradeTitle.hidden=!summary.known;gradeTitle.textContent=c.gradeTitle;
    var bar=node.querySelector('.ct-calorieapp-nutrition-bar'),grades=['A','B','C','D','E'];bar.replaceChildren();
    bar.hidden=!summary.known;node.querySelector('.ct-calorieapp-nutrition-counts').hidden=!summary.known;
    node.querySelector('.ct-calorieapp-nutrition-details').hidden=!summary.total;
    bar.setAttribute('aria-label',c.title+' · '+grades.map(function(grade){return grade+': '+number.format(summary.counts[grade]);}).join(', '));
    if(summary.known){grades.forEach(function(grade){var value=summary.counts[grade];if(!value)return;var segment=document.createElement('span');segment.className='ct-calorieapp-nutrition-segment ct-grade-'+grade.toLowerCase();segment.style.width=(value/summary.known*100)+'%';segment.title=grade+': '+number.format(value);segment.setAttribute('aria-hidden','true');segment.textContent=grade;bar.append(segment);});}
    [['open_food_facts','off'],['usda','usda'],['other','other']].forEach(function(pair){var item=node.querySelector('[data-ct-nutrition-source="'+pair[0]+'"]');item.querySelector('dt').textContent=c[pair[1]];item.querySelector('dd').textContent=number.format(summary.sources[pair[0]]);});
    node.querySelectorAll('[data-ct-nutrition-grade]').forEach(function(item){var grade=item.dataset.ctNutritionGrade;item.querySelector('dd').textContent=number.format(summary.counts[grade]);});
  }
  function clear(){summary=null;state='hidden';render();}
  function sendPeriod(value){
    var frame=eligibleFrame(),origin=frame&&targetOrigin(frame),period=validPeriod(value);if(!frame||!origin||!period)return;
    selectedPeriod=period;summary=null;state='loading';render();
    frame.contentWindow.postMessage({type:'calorieapp:nutrition-period',version:1,period:period},origin);
  }
  function install(){
    if(!isCalorieAppPage())return true;
    if(node&&node.isConnected)return true;
    var frame=eligibleFrame();if(!frame)return false;
    var section=document.createElement('section'),title=document.createElement('strong'),scope=document.createElement('p'),controls=document.createElement('div'),status=document.createElement('p'),body=document.createElement('div'),coverage=document.createElement('p'),bar=document.createElement('div'),grid=document.createElement('dl'),details=document.createElement('details'),detailsLabel=document.createElement('summary'),sourceGrid=document.createElement('dl'),note=document.createElement('p'),logged=document.createElement('p'),partial=document.createElement('p'),gradeTitle=document.createElement('p');
    section.id='ct-calorieapp-nutrition-summary';section.className='ct-calorieapp-nutrition-summary';section.hidden=true;
    title.className='ct-calorieapp-nutrition-title';scope.className='ct-calorieapp-nutrition-scope';controls.className='ct-calorieapp-nutrition-periods';controls.setAttribute('role','group');status.className='ct-calorieapp-nutrition-status';status.setAttribute('aria-live','polite');body.className='ct-calorieapp-nutrition-body';coverage.className='ct-calorieapp-nutrition-coverage';bar.className='ct-calorieapp-nutrition-bar';bar.setAttribute('role','img');grid.className='ct-calorieapp-nutrition-counts';grid.dir='ltr';details.className='ct-calorieapp-nutrition-details';detailsLabel.className='ct-calorieapp-nutrition-details-label';sourceGrid.className='ct-calorieapp-nutrition-sources';note.className='ct-calorieapp-nutrition-note';
    periods.forEach(function(period){var button=document.createElement('button');button.type='button';button.dataset.ctNutritionPeriod=period;button.addEventListener('click',function(){sendPeriod(period);});controls.append(button);});
    ['A','B','C','D','E'].forEach(function(grade){var item=document.createElement('div'),key=document.createElement('dt'),value=document.createElement('dd');item.dataset.ctNutritionGrade=grade;item.className='ct-calorieapp-nutrition-grade ct-grade-'+grade.toLowerCase();key.textContent=grade;value.textContent='0';item.append(key,value);grid.append(item);});
    ['open_food_facts','usda','other'].forEach(function(source){var item=document.createElement('div'),key=document.createElement('dt'),value=document.createElement('dd');item.dataset.ctNutritionSource=source;key.textContent=source;value.textContent='0';item.append(key,value);sourceGrid.append(item);});
    logged.className='ct-calorieapp-nutrition-logged';partial.className='ct-calorieapp-nutrition-partial';gradeTitle.className='ct-calorieapp-nutrition-grade-title';
    coverage.setAttribute('aria-live','polite');
    details.append(detailsLabel,sourceGrid,note);body.append(logged,coverage,partial,gradeTitle,bar,grid,details);section.append(title,scope,controls,status,body);frame.before(section);node=section;
    if(frame.dataset.ctNutritionLoadBound!=='1'){frame.dataset.ctNutritionLoadBound='1';frame.addEventListener('load',clear);}
    render();return true;
  }
  window.addEventListener('message',function(event){
    var frame=eligibleFrame(),data=event.data;
    if(!frame||event.source!==frame.contentWindow||!allowedOrigins.includes(event.origin)||!data||data.type!=='calorieapp:nutrition-summary'||data.version!==1)return;
    var period=validPeriod(data.period);if(!period){clear();return;}selectedPeriod=period;
    if(data.status==='signed_out'){clear();return;}
    if(data.status==='loading'||data.status==='unavailable'){summary=null;state=data.status;install();render(data.locale);return;}
    var next=normaliseNutrition(data);if(!next){clear();return;}summary=next;state='ready';install();render(data.locale);
  });
  document.addEventListener('change',function(event){if(event.target&&event.target.matches&&event.target.matches('#ctstyle-language-select,#ctstyle-account-language'))render(event.target.value);},true);
  window.addEventListener('pagehide',clear);
  function ready(){
    if(install())return;var observer=new MutationObserver(function(){if(install())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});
    window.setTimeout(function(){observer.disconnect();install();},10000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
