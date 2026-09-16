/* Private aggregate product-grade summary for the existing account card. GPL-2.0-or-later. */
(function(){'use strict';
  var allowedOrigins=['https://app.calorietoken.net','https://calorieapp-frontend.onrender.com'];
  var labels={
    en:{title:'Your food log at a glance',scope:'Aggregate counts for the selected period.',coverage:'OFF Nutri-Score supplied: {known} of {off} OFF products.',empty:'No OFF product Nutri-Score is available for this period.',off:'Open Food Facts',usda:'USDA',other:'Other / unknown',note:'All sources count in app nutrient totals. A–E applies only to source-supplied OFF product grades.'},
    nl:{title:'Je eetdagboek in één oogopslag',scope:'Geaggregeerde aantallen voor de gekozen periode.',coverage:'OFF Nutri-Score aangeleverd: {known} van {off} OFF-producten.',empty:'Voor deze periode is geen Nutri-Score van een OFF-product beschikbaar.',off:'Open Food Facts',usda:'USDA',other:'Overig / onbekend',note:'Alle bronnen tellen mee in de voedingstotalen van de app. A–E geldt alleen voor door OFF aangeleverde productscores.'},
    'zh-Hans':{title:'饮食记录概览',scope:'所选时段的汇总计数。',coverage:'OFF 提供的 Nutri-Score：{known}/{off} 个 OFF 产品。',empty:'此时段没有可用的 OFF 产品 Nutri-Score。',off:'Open Food Facts',usda:'USDA',other:'其他',note:'所有来源都计入应用的营养总量。A–E 仅适用于 OFF 来源提供的产品等级。'},
    hi:{title:'आपकी भोजन डायरी एक नज़र में',scope:'चुनी गई अवधि की समेकित गिनती।',coverage:'OFF Nutri-Score उपलब्ध: {off} OFF उत्पादों में से {known}।',empty:'इस अवधि के लिए कोई OFF उत्पाद Nutri-Score उपलब्ध नहीं है।',off:'Open Food Facts',usda:'USDA',other:'अन्य',note:'सभी स्रोत ऐप के पोषण योग में शामिल हैं। A–E केवल OFF द्वारा दिए उत्पाद ग्रेड पर लागू है।'},
    es:{title:'Tu diario de un vistazo',scope:'Recuentos agregados del período seleccionado.',coverage:'Nutri-Score de OFF: {known} de {off} productos OFF.',empty:'No hay ningún Nutri-Score de producto OFF disponible en este período.',off:'Open Food Facts',usda:'USDA',other:'Otra',note:'Todas las fuentes cuentan en los totales nutricionales de la app. A–E solo se aplica a clasificaciones de producto proporcionadas por OFF.'},
    ar:{title:'سجل طعامك في لمحة',scope:'أعداد مجمعة للفترة المحددة.',coverage:'Nutri-Score من OFF: ‏{known} من {off} من منتجات OFF.',empty:'لا تتوفر درجة Nutri-Score لمنتج OFF في هذه الفترة.',off:'Open Food Facts',usda:'USDA',other:'أخرى',note:'تدخل كل المصادر في مجاميع العناصر الغذائية داخل التطبيق. تنطبق A–E فقط على درجات المنتجات التي يوفرها OFF.'},
    fr:{title:'Votre journal en un coup d’œil',scope:'Comptes agrégés pour la période choisie.',coverage:'Nutri-Score OFF fourni : {known} sur {off} produits OFF.',empty:'Aucun Nutri-Score de produit OFF n’est disponible pour cette période.',off:'Open Food Facts',usda:'USDA',other:'Autre',note:'Toutes les sources comptent dans les totaux nutritionnels de l’app. A–E concerne uniquement les classes de produit fournies par OFF.'},
    bn:{title:'এক নজরে আপনার খাবারের ডায়েরি',scope:'নির্বাচিত সময়ের সমষ্টিগত সংখ্যা।',coverage:'OFF Nutri-Score আছে: {off}টি OFF পণ্যের মধ্যে {known}টি।',empty:'এই সময়ে কোনো OFF পণ্যের Nutri-Score নেই।',off:'Open Food Facts',usda:'USDA',other:'অন্যান্য',note:'সব উৎস অ্যাপের পুষ্টির মোট হিসাবে ধরা হয়। A–E শুধু OFF-এর দেওয়া পণ্যের গ্রেডে প্রযোজ্য।'},
    pt:{title:'Seu diário num relance',scope:'Contagens agregadas do período selecionado.',coverage:'Nutri-Score OFF fornecido: {known} de {off} produtos OFF.',empty:'Não há Nutri-Score de produto OFF disponível neste período.',off:'Open Food Facts',usda:'USDA',other:'Outra',note:'Todas as fontes contam nos totais nutricionais da app. A–E aplica-se apenas às classificações de produto fornecidas pelo OFF.'},
    id:{title:'Catatan makananmu sekilas',scope:'Jumlah agregat untuk periode yang dipilih.',coverage:'Nutri-Score OFF tersedia: {known} dari {off} produk OFF.',empty:'Tidak ada Nutri-Score produk OFF untuk periode ini.',off:'Open Food Facts',usda:'USDA',other:'Lainnya',note:'Semua sumber masuk dalam total gizi aplikasi. A–E hanya berlaku untuk peringkat produk dari OFF.'},
    ur:{title:'آپ کی خوراک کی ڈائری ایک نظر میں',scope:'منتخب مدت کی مجموعی گنتی۔',coverage:'OFF Nutri-Score دستیاب: {off} OFF پروڈکٹس میں سے {known}۔',empty:'اس مدت کے لیے کسی OFF پروڈکٹ کا Nutri-Score دستیاب نہیں۔',off:'Open Food Facts',usda:'USDA',other:'دیگر',note:'تمام ذرائع ایپ کے غذائی مجموعوں میں شامل ہیں۔ A–E صرف OFF کے فراہم کردہ پروڈکٹ گریڈز پر لاگو ہے۔'}
  };
  var node=null,summary=null;
  function locale(preferred){
    var picker=document.querySelector('#ctstyle-language-select,#ctstyle-account-language');
    var value=typeof preferred==='string'&&preferred||picker&&picker.value||document.documentElement.lang||'en';
    if(/^zh(?:-|$)/i.test(value))return 'zh-Hans';
    value=value.split('-')[0];return labels[value]?value:'en';
  }
  function copy(preferred){return labels[locale(preferred)]||labels.en;}
  function eligibleFrame(){
    var frames=Array.from(document.querySelectorAll('iframe[title="CalorieApp"]')).filter(function(frame){
      try{return allowedOrigins.includes(new URL(frame.src,window.location.href).origin);}catch(_){return false;}
    });
    return frames.length===1?frames[0]:null;
  }
  function normaliseNutrition(data){
    if(!data||data.type!=='calorieapp:nutrition-summary'||data.version!==1||data.status!=='ready')return null;
    var total=data.total,known=data.known,missing=data.missing,counts=data.counts,sources=data.sources,limit=100000;
    function count(value){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=limit;}
    if(!count(total)||!count(known)||!count(missing)||!counts||typeof counts!=='object'||Array.isArray(counts)||!sources||typeof sources!=='object'||Array.isArray(sources))return null;
    var grades=['A','B','C','D','E'],sum=0,safe={};
    for(var i=0;i<grades.length;i++){var grade=grades[i],value=counts[grade];if(!count(value))return null;safe[grade]=value;sum+=value;}
    var sourceKeys=['open_food_facts','usda','other'],sourceTotal=0,safeSources={};
    for(var j=0;j<sourceKeys.length;j++){var key=sourceKeys[j],sourceCount=sources[key];if(!count(sourceCount))return null;safeSources[key]=sourceCount;sourceTotal+=sourceCount;}
    if(sum!==known||known+missing!==safeSources.open_food_facts||sourceTotal!==total)return null;
    return {locale:locale(data.locale),total:total,known:known,missing:missing,counts:safe,sources:safeSources};
  }
  function format(template,values){return template.replace(/\{(known|off|total)\}/g,function(_,key){return values[key];});}
  function render(preferred){
    if(!node)return;
    if(!summary){node.hidden=true;return;}
    var tag=locale(preferred||summary.locale),c=copy(tag),number=new Intl.NumberFormat(tag);
    node.lang=tag;node.dir=tag==='ar'||tag==='ur'?'rtl':'ltr';node.hidden=false;node.setAttribute('aria-label',c.title);
    node.querySelector('.ct-calorieapp-nutrition-title').textContent=c.title;
    node.querySelector('.ct-calorieapp-nutrition-scope').textContent=c.scope;
    node.querySelector('.ct-calorieapp-nutrition-note').textContent=c.note;
    node.querySelector('.ct-calorieapp-nutrition-coverage').textContent=summary.sources.open_food_facts===0?c.empty:format(c.coverage,{known:number.format(summary.known),off:number.format(summary.sources.open_food_facts),total:number.format(summary.total)});
    [['open_food_facts','off'],['usda','usda'],['other','other']].forEach(function(pair){var item=node.querySelector('[data-ct-nutrition-source="'+pair[0]+'"]');item.querySelector('dt').textContent=c[pair[1]];item.querySelector('dd').textContent=number.format(summary.sources[pair[0]]);});
    node.querySelectorAll('[data-ct-nutrition-grade]').forEach(function(item){var grade=item.dataset.ctNutritionGrade;item.querySelector('dd').textContent=number.format(summary.counts[grade]);});
  }
  function clear(){summary=null;render();}
  function install(){
    if(node&&node.isConnected)return true;
    var account=document.getElementById('ctstyle-account-app'),frame=eligibleFrame();if(!account||!frame)return false;
    var section=document.createElement('section'),title=document.createElement('strong'),scope=document.createElement('p'),sourceGrid=document.createElement('dl'),note=document.createElement('p'),coverage=document.createElement('p'),grid=document.createElement('dl');
    section.id='ct-calorieapp-nutrition-summary';section.className='ct-calorieapp-nutrition-summary';section.hidden=true;
    title.className='ct-calorieapp-nutrition-title';scope.className='ct-calorieapp-nutrition-scope';sourceGrid.className='ct-calorieapp-nutrition-sources';note.className='ct-calorieapp-nutrition-note';coverage.className='ct-calorieapp-nutrition-coverage';coverage.setAttribute('aria-live','polite');grid.className='ct-calorieapp-nutrition-counts';grid.dir='ltr';
    ['open_food_facts','usda','other'].forEach(function(source){var item=document.createElement('div'),key=document.createElement('dt'),value=document.createElement('dd');item.dataset.ctNutritionSource=source;key.textContent=source;value.textContent='0';item.append(key,value);sourceGrid.append(item);});
    ['A','B','C','D','E'].forEach(function(grade){var item=document.createElement('div'),key=document.createElement('dt'),value=document.createElement('dd');item.dataset.ctNutritionGrade=grade;item.className='ct-calorieapp-nutrition-grade ct-grade-'+grade.toLowerCase();key.textContent=grade;value.textContent='0';item.append(key,value);grid.append(item);});
    section.append(title,scope,sourceGrid,note,coverage,grid);account.append(section);node=section;
    if(frame.dataset.ctNutritionLoadBound!=='1'){frame.dataset.ctNutritionLoadBound='1';frame.addEventListener('load',clear);}
    render();return true;
  }
  window.addEventListener('message',function(event){
    var frame=eligibleFrame();
    if(!frame||event.source!==frame.contentWindow||!allowedOrigins.includes(event.origin)||!event.data||event.data.type!=='calorieapp:nutrition-summary'||event.data.version!==1)return;
    summary=normaliseNutrition(event.data);install();render(event.data.locale);
  });
  document.addEventListener('change',function(event){if(event.target&&event.target.matches&&event.target.matches('#ctstyle-language-select,#ctstyle-account-language'))render(event.target.value);},true);
  window.addEventListener('pagehide',clear);
  function ready(){
    if(install())return;var observer=new MutationObserver(function(){if(install())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});
    window.setTimeout(function(){observer.disconnect();install();},10000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
