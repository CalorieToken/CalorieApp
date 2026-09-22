/* Calorie help: fixed first-party answers, processed on this page. GPL-2.0-or-later. */
(function () {
  'use strict';
  function safeQueryKey(key){return key==='ui_lang'||/^(?:utm_(?:source|medium|campaign|term|content|id)|gclid|dclid|fbclid|msclkid|ttclid|twclid)$/.test(key);}
  var cfg = window.CalorieTokenHelp;
  if (!cfg || !cfg.copy || window.CalorieTokenHelpUI) return;
  var views = [], locale = 'en';
  var visibleTopics = ['app','search','scan','compare','recipes','usda','contribute','diary','account','test','move','export','history','exchange','market','xamanSwap','crosschain','trustline','donations','docs','usecases','community','showcases','siteNavigation','troubleshoot','legal'];
  visibleTopics=visibleTopics.filter(function(key){return !!cfg.copy.en.topics[key];});
  var adultOnlyTopics = ['test','move','export','account','diary','exchange','market','xamanSwap','crosschain','trustline','donations'];
  var primaryTopics = {
    child:['app','usda','docs','legal'],
    teen:['app','usda','docs','legal'],
    adult:['app','usda','test','docs']
  };
  var protectedArea = 'form,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],[hidden],[inert]';
  var routes = {
    foodSearch:['Search foods','/calorieapp/#food-search'],foodScan:['Scan food','/calorieapp/#food-scan'],foodCompare:['Compare foods','/calorieapp/#food-compare'],
    foodBasic:['Basic foods','/calorieapp/#basic-foods'],foodDiary:['Food diary','/calorieapp/#food-diary'],
    account:['My account','/calorieapp/#account'],accountExport:['Export tools','/calorieapp/#account-export'],accountMove:['Move to a real account','/calorieapp/#move-account'],testAccount:['Set up a test account','/calorieapp/#test-account'],
    app:['CalorieApp','/index.php/calorieapp/'], test:['XRPL Testnet','/index.php/calorieapp/#ctstyle-testnet'],
    home:['Home','/'],whitepaperPage:['Whitepaper','/whitepaper/'],roadmapPage:['Roadmap','/roadmap/'],
    tokenomics:['Tokenomics','/tokenomics-update/'],richlist:['Holders','/richlist/'],
    blog:['Blog','/blog/'],community:['Community hub','/community-voting-hub-info/'],showcases:['Showcases','/showcases/'],merch:['Merch & NFTs','/merchnfts/'],
    delivery:['Delivery','/delivery/'],cafes:['Cafés','/cafes/'],takeaway:['Takeaway','/takeaway/'],restaurants:['Restaurants','/restaurants/'],groceries:['Groceries','/groceries/'],wholesalers:['Wholesalers','/wholesalers/'],
    faq:['FAQ','/index.php/faq/'], trustline:['CAL Trustline','/how-to-buy-calorie/#ct-cal-trustline'],
    exchange:['CAL & Crypto','/how-to-buy-calorie/#ctstyle-own-dex'],
    market:['CAL market overview','/how-to-buy-calorie/#ct-cal-market'],xamanSwap:['Swap inside Xaman','/how-to-buy-calorie/#ct-xaman-swap'],crosschain:['SWFT','/how-to-buy-calorie/#ctstyle-external-exchange'], privacy:['Privacy Policy','/index.php/privacy-policy/'],
    terms:['Terms & Conditions','/index.php/terms-conditions/'], contact:['Contact','/index.php/contact/'],
    docs:['GitHub · Publications','https://github.com/CalorieToken/Publications'],
    whitepaper:['Whitepaper','https://github.com/CalorieToken/Publications/blob/main/whitepaper/CalorieToken-Whitepaper.pdf'],
    roadmap:['Roadmap Explained','https://github.com/CalorieToken/Publications/blob/main/roadmap/README.md'],
    archives:['Whitepaper archive','https://github.com/CalorieToken/Publications/blob/main/whitepaper/archive/README.md'],
    history:['Roadmap archive','https://github.com/CalorieToken/Publications/blob/main/roadmap/archive/README.md'],
    appSource:['GitHub · CalorieApp','https://github.com/CalorieToken/CalorieApp'],
    foodDiscovery:['GitHub · USDA / Open Food Facts','https://github.com/CalorieToken/CalorieApp/blob/herstel/vervolg-20260915/docs/public/food-discovery-2026-09.md'],
    contribute:['Contribute food data','/contribute-food-data/'],contributeOff:['Open Food Facts','/contribute-food-data/#off'],contributeUsda:['USDA · FoodData Central','/contribute-food-data/#usda'],contributePlan:['Calorie data plan','/contribute-food-data/#calorie-data-plan'],
    usda:['USDA · FoodData Central','https://fdc.nal.usda.gov/'],
    donations:['Donations','/donate/'],
    donationWallet:['Bithomp · XRP','https://bithomp.com/explorer/rEfiRssDCQd466z2bi63vi64u2rYiMrnhL'],
    xaman:['Xaman · Testnet','https://help.xaman.app/app/learning-more-about-xaman/how-to-access-testnet-on-xrp-ledger']
  };
  var keywords = {
    recipes:['recipe','recipes','recept','recepten','receptidee','receptsuggesties','eetstijl','eetgewoonte','keuken','halal','kosher','koosjer','vegetarisch','recette','recettes','receta','receita','resep','食谱','रेसिपी','وصفة','রেসিপি','ترکیب'],
    search:['zoeken','zoek','voedsel zoeken','search','find food','rechercher','chercher','buscar','pesquisar','cari','搜索','खोज','بحث','খুঁজ','تلاش'],
    scan:['scan','scannen','barcode','barcodes','scanner','code-barres','条码','बारकोड','باركود','বারকোড','código de barras','kode batang','بارکوڈ'],
    account:['account','accountbeheer','accountfuncties','profiel','profile','nickname','bijnaam','login','logout','aanmelden','inloggen','uitloggen','compte','cuenta','conta','akun','账户','खाता','حساب','অ্যাকাউন্ট','اکاؤنٹ'],
    export:['export','exporteren','exporter','exportar','ekspor','导出','निर्यात','تصدير','রপ্তানি','برآمد'],
    move:['overstappen','overzetten','echt account','real account','mainnet','compte réel','cuenta real','conta real','akun nyata','真实账户','वास्तविक खाता','حساب حقيقي','বাস্তব অ্যাকাউন্ট','حقیقی اکاؤنٹ'],
    diary:['dagboek','eetdagboek','diary','food log','journal alimentaire','diario','diário','catatan makanan','饮食记录','भोजन डायरी','يوميات الطعام','খাদ্য ডায়েরি','غذائی ڈائری'],
    usda:['usda','fdc','foundation','sr legacy','nutri-score','nutri score','nutriscore','ingredient','ingredients','ingrediënt','ingrediënten','basisvoeding','食材','सामग्री','مكون','مكوّن','উপকরণ','ingrediente','ingrédient','bahan','اجزا'],
    compare:['keurmerk','keurmerken','label','labels','beter leven','biologisch','ecologisch','ecologischer','ecologische','diervriendelijk','diervriendelijke','dierenwelzijn','plantaardig','plantaardige','vegan','gezondere','gezonder','andere merken','eco','ecological','animal welfare','plant based','plant-based','healthier','other brands','végétal','bien-être animal','vegetal','bienestar animal','nabati','kesejahteraan hewan','植物性','动物福利','पौध','पशु कल्याण','نباتي','رفق بالحيوان','উদ্ভিদভিত্তিক','প্রাণীকল্যাণ','نباتاتی','جانوروں کی فلاح','compare','comparison','similar','alternative','alternatives','alternatief','alternatieven','vergelijk','vergelijken','vergelijkbaar','vergelijkbare','比较','相似','तुलना','विकल्प','قارن','مقارنة','তুলনা','বিকল্প','comparar','similares','comparer','semblable','semelhante','bandingkan','serupa','موازنہ','متبادل'],
    donations:['donation','donations','donate','donatie','donaties','doneren','donation balance','donatiesaldo','consolidation','consolidatie','捐赠','दान','تبرع','অনুদান','donación','donaciones','dons','donativos','donasi','عطیات'],
    test:['test','testnet','faucet','proberen','oefenen','testaccount','recovery seed','herstelcode','private key','测试','昵称','导出','导入','परीक्ष','उपनाम','निर्यात','आयात','اختبار','اسم مستعار','تصدير','استيراد','পরীক্ষা','ডাকনাম','রপ্তানি','আমদানি','apodo','exportar','importar','surnom','exporter','importer','alcunha','ekspor','impor','آزمائش','نک نیم'],
    trustline:['trustline','trust set','issuer','uitgever','hex','信任','ट्रस्ट','ثقة','ট্রাস্ট','ٹرسٹ'],
    market:['koers','prijs','price','chart','grafiek','market cap','volume','liquidity','liquiditeit','market metrics','holders','houders','koerswijziging','wisselkoers','valuta','currency','fiat','usd','eur','gbp','jpy','cny','chf','prix','cours','volumen','liquidez','liquidité','precio','preço','harga','likuiditas','价格','成交量','流动性','कीमत','मात्रा','तरलता','سعر','السيولة','حجم التداول','দাম','লেনদেনের পরিমাণ','قیمت','تجارتی حجم'],
    xamanSwap:['xaman swap','swap xaman','xaman','xumm'],
    crosschain:['swft','sftw','allchain','bridge','cross chain','cross-chain','bitcoin','btc','eth','跨链','بين الشبكات'],
    exchange:['exchange','magnetic','xpmarket','xrpl.to','platform','dex','kopen','verkopen','wisselen','buy','sell','swap','bitcoin','btc','eth','兑换','खरीद','شراء','বিনিময়','trocar','tukar','خرید'],
    legal:['privacy','licence','license','licentie','legal','juridisch','mica','cookie','terms','voorwaarden','copyright','disclosure','garantie','profit','rendement','隐私','गोपनीय','خصوص','গোপনীয়','privacidade','lisensi','شرائط'],
    docs:['roadmap','whitepaper','documents','documenten','publication','publicatie','bron','source','路线','दस्तावेज़','وثائق','নথি','dokumen','دستاویز'],
    app:['barcode','barcodes','scannen','scan','条码','बारकोड','باركود','বারকোড','código de barras','code-barres','kode batang','بارکوڈ','calorieapp','food','voeding','dagboek','login','logout','aanmelden','inloggen','uitloggen','diary','portion','portie','食品','भोजन','طعام','খাবার','alimento','makanan','کھانا'],
    history:['history','historie','geschiedenis','oorsprong','origins','2021','历史','इतिहास','historia','تاريخ','histoire','ইতিহাস','história','sejarah','تاریخ'],
    troubleshoot:['laden','laadt','loading','load','blank','leeg','cookies','iframe','embed','werkt niet','werktniet','scroll','麦克','加载','लोड','carga','تحميل','charge','লোড','carrega','muat','لوڈ'],
    voice:['microphone','microfoon','dictation','dicteren','voice','spraak','micrófono','micrófone','microfone','voix','suara','语音','आवाज़','الصوت','কথা','آواز'],
    contact:['contact','support','email','e-mail','ticket','contacto','联系','संपर्क','اتصال','যোগাযোগ','contato','kontak','رابطہ']
  };
  Object.assign(keywords,{
    usecases:['usecase','usecases','use case','delivery','bezorging','cafes','cafés','takeaway','afhalen','restaurants','groceries','boodschappen','wholesalers','groothandel','cas d’usage','caso de uso','casos de uso','penerapan','应用构想','使用场景','उपयोग','استخدام','ব্যবহারের ধারণা','استعمال'],
    contribute:['contribute','bijdragen','voedingsdata','open food facts','openfoodfacts','missing product','product photo','add product','food data','ontbrekend product','product toevoegen','verpakkingsfoto','foto toevoegen','bigchaindb','bigchain','provenance','calorie database','caloriedb','food database','voedseldatabase','herkomst','wijzigingsgeschiedenis','contribuer','données alimentaires','produit manquant','base de données alimentaire','contribuir','datos alimentarios','producto ausente','base de datos alimentaria','dados alimentares','banco de dados de alimentos','berkontribusi','data pangan','basis data pangan','贡献','添加产品','食品数据库','योगदान','उत्पाद जोड़','खाद्य डेटाबेस','المساهمة','إضافة منتج','قاعدة بيانات غذائية','অবদান','পণ্য যোগ','খাদ্য ডেটাবেস','تعاون','مصنوعات شامل','غذائی ڈیٹابیس'],
    community:['community','gemeenschap','voting','vote','voting hub','stemmen','stemming','merch','nft','blog','communauté','comunidad','comunidade','komunitas','社区','समुदाय','المجتمع','কমিউনিটি','کمیونٹی'],
    showcases:['showcases','showcase','video','youtube','carrousel','carousel','tour','rondleiding','vijf jaar','five years','vidéo','vídeo','视频','वीडियो','فيديو','ভিডিও','ویڈیو'],
    siteNavigation:['language','taal','vertaling','slogan','rtl','arabic','arabisch','urdu','menu','navigation','navigatie','floating buttons','zwevende knoppen','langue','idioma','bahasa','语言','भाषा','اللغة','العربية','ভাষা','زبان']
  });
  keywords.docs.push('tokenomics','tokenomica','tokenomique','richlist','houderslijst','distribution','verdeling','代币经济','टोकन अर्थव्यवस्था','اقتصاد الرمز','টোকেন অর্থনীতি','ٹوکن اکنامکس');
  function allowed() {
    return document.body && document.body.matches('.ctstyle-enabled,.ctstyle-footer-only') &&
      !document.body.matches('.page-id-8001,.brz-ed') && !document.querySelector('.brz-ed,#brz-ed-iframe,[contenteditable="true"]') &&
      ['https://calorietoken.net','https://www.calorietoken.net'].includes(window.location.origin) &&
      !/\/wp-admin\//.test(window.location.pathname) &&
      Array.from(new URL(window.location.href).searchParams.keys()).every(safeQueryKey);
  }
  function el(tag,text,cls) { var node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; }
  function resolveLocale(value) {
    var tag=typeof value==='string'?value.trim().replace(/_/g,'-').toLowerCase():'';
    var exact=Object.keys(cfg.copy).find(function(key){return key.toLowerCase()===tag;});
    if(exact)return exact;
    if(/^(?:zh|zh-(?:hans(?:-[a-z]{2})?|cn|sg))$/.test(tag)&&cfg.copy['zh-Hans'])return 'zh-Hans';
    var primary=tag.split('-')[0];
    return Object.prototype.hasOwnProperty.call(cfg.copy,primary)?primary:null;
  }
  function routeLabel(id) {
    var route=routes[id], copy=cfg.copy[locale], shared=window.CalorieTokenSiteStyleMenu;
    // Use the same public route labels as the rest of the site when present.
    if(route[1].startsWith('/')) {
      var path=route[1].split('#')[0].replace(/^\/index\.php(?=\/|$)/,'').replace(/\/+$/,'')||'/';
      var label=shared&&shared.sharedLabels&&shared.sharedLabels[locale]&&shared.sharedLabels[locale][path];
      if(typeof label==='string'&&label.trim()&&route[1].indexOf('#')===-1)return label;
    }
    var fallback=copy.linkLabels&&copy.linkLabels[id];
    return typeof fallback==='string'&&fallback.trim()?fallback:route[0];
  }
  function link(id) {
    var route=routes[id], a=el('a',routeLabel(id),'ctstyle-help-link');
    a.lang=locale; a.dir=['ar','ur'].includes(locale)?'rtl':'ltr';
    if(route[1].startsWith('/')){var destination=new URL(route[1],window.location.origin);destination.searchParams.set('ui_lang',locale);a.href=destination.href;}else a.href=route[1];
    if (!route[1].startsWith('/')) { a.target='_blank'; a.rel='noopener noreferrer'; }
    return a;
  }
  function topic(query) {
    var text=String(query||'').slice(0,160).normalize('NFKC').toLowerCase().trim();
    if (!text) return null;
    var candidates=Object.keys(keywords).filter(function (key) {
      var title=cfg.copy[locale].topics[key]?.title || (key==='voice'?cfg.copy[locale].voiceTitle:'');
      return keywords[key].some(function (word) {
        if (/^[a-z0-9 -]+$/.test(word)) return new RegExp('(?:^|[^a-z0-9])'+word.replace(/ /g,'\\s+')+'(?:$|[^a-z0-9])','i').test(text);
        return text.includes(word);
      }) || (typeof title==='string'&&title&&text===title.normalize('NFKC').toLowerCase());
    });
    // Contact is returned only when explicitly requested, never as a failure path.
    var selected=null;
    if(candidates.includes('siteNavigation'))selected='siteNavigation';
    else if(candidates.includes('market')&&(candidates.includes('troubleshoot')||candidates.includes('legal')))selected='troubleshoot';
    else if (candidates.includes('legal') && !candidates.includes('troubleshoot') && !candidates.includes('account')) selected='legal';
    else if (candidates.includes('contribute')) selected='contribute';
    else if (candidates.includes('recipes')) selected='recipes';
    else if (candidates.includes('compare')) selected='compare';
    else if (candidates.includes('usda')) selected='usda';
    else if (candidates.includes('move')) selected='move';
    else if (candidates.includes('export')) selected='export';
    else if (candidates.includes('test')) selected='test';
    else if (candidates.includes('scan')) selected='scan';
    else if (candidates.includes('search')) selected='search';
    else if (candidates.includes('diary')) selected='diary';
    else if (candidates.includes('account')) selected='account';
    else if(candidates.includes('trustline'))selected='trustline';
    else if(candidates.includes('market'))selected='market';
    else if(candidates.includes('crosschain'))selected='crosschain';
    else if(candidates.includes('xamanSwap'))selected='xamanSwap';
    else if(candidates.includes('usecases'))selected='usecases';
    else if(candidates.includes('showcases'))selected='showcases';
    else if(candidates.includes('community'))selected='community';
    else if(candidates.includes('docs'))selected='docs';
    else if(candidates.length===1)selected=candidates[0];
    var age=getAgeBand();
    return age!=='adult'&&adultOnlyTopics.includes(selected)?'ageSafety':selected;
  }
  function getAgeApi() { return window.CalorieTokenAgeExperience || null; }
  function getAgeBand() { var api=getAgeApi(); return api&&api.getBand?api.getBand():null; }
  function getAgeCopy() { var api=getAgeApi(); return api&&api.copy?api.copy():null; }
  function topicAllowed(key) { return getAgeBand()==='adult'||!adultOnlyTopics.includes(key); }
  function avatar() {
    if (!cfg.avatar) return null;
    var image=el('img',null,'ctstyle-help-avatar'); image.src=cfg.avatar;
    image.alt=''; image.width=64; image.height=64; image.decoding='async';
    return image;
  }
  function bodyContent(container,data,copy) {
    container.replaceChildren(el('p',data.text));
    if (Array.isArray(data.steps) && data.steps.length) {
      var steps=el('ol',null,'ctstyle-help-steps');
      data.steps.forEach(function(text){steps.append(el('li',text));}); container.append(steps);
    }
    var actions=el('div',null,'ctstyle-help-links ctstyle-help-actions');
    (data.actions||[]).forEach(function(id){if(routes[id]){var a=link(id);a.classList.add('ctstyle-discovery-action');actions.append(a);}});
    if(actions.childNodes.length)container.append(actions);
    var sources=el('div',null,'ctstyle-help-links');
    (data.links || []).forEach(function(id){if(routes[id])sources.append(link(id));});
    if(sources.childNodes.length) container.append(el('p',copy.sourcesLabel||copy.docsTitle||'','ctstyle-help-source-label'),sources);
  }
  function topicData(key) {
    var copy=cfg.copy[locale],data=copy.topics[key],age=getAgeBand(),ageCopy=getAgeCopy();
    if(key==='voice')return copy.voiceTitle&&copy.voiceText?{title:copy.voiceTitle,text:[copy.voiceText,copy.voiceNote].filter(Boolean).join(' '),links:[]}:null;
    if(key==='ageSafety')return ageCopy?{title:ageCopy.helpTitle,text:ageCopy.helpText,links:[]}:{title:'Age-appropriate help',text:'Wallet and transaction instructions are not shown in this age setting.',links:[]};
    if(key==='app'&&age!=='adult'&&ageCopy){
      var note=ageCopy[(age==='teen'?'teen':'child')+'Note'];
      return {title:data.title,text:[note,ageCopy.helpText].filter(Boolean).join(' '),links:['app','faq'],actions:['foodSearch','foodScan']};
    }
    if(!data)return data;
    var actions={app:['foodSearch','foodScan','foodDiary'],search:['foodSearch'],scan:['foodScan'],compare:['foodCompare'],recipes:['foodSearch','foodBasic'],usda:['foodBasic'],diary:['foodDiary'],account:['account','testAccount','accountMove','accountExport'],test:['testAccount','account'],move:['accountMove'],export:['accountExport'],exchange:['exchange','trustline'],market:['market'],xamanSwap:['xamanSwap'],crosschain:['crosschain'],trustline:['trustline']};
    return Object.assign({},data,{actions:actions[key]||[]});
  }
  function answer(view,key,focusReply) {
    view.selected=key; var copy=cfg.copy[locale],data=topicData(key);
    view.replyTitle.textContent=data?data.title:copy.examplesLabel;
    bodyContent(view.replyBody,data || {text:copy.unknown,links:['faq','docs']},copy);
    view.reply.hidden=false; view.clear.hidden=!view.hasClear;
    view.choices.forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.topic===key));});
    if(focusReply){
      view.replyTitle.setAttribute('tabindex','-1');
      view.replyTitle.focus({preventScroll:true});
      var panel=view.root.closest('.ctstyle-app-launcher-panel');
      if(panel && typeof panel.scrollTo==='function'){
        var head=view.root.querySelector('.ctstyle-help-header');
        var space=(head?head.getBoundingClientRect().height:0)+24;
        var top=panel.scrollTop+view.reply.getBoundingClientRect().top-panel.getBoundingClientRect().top-space;
        panel.scrollTo({top:Math.max(0,top),behavior:'auto'});
      }else if(!panel && typeof view.replyTitle.scrollIntoView==='function'){
        view.replyTitle.scrollIntoView({block:'center',behavior:'auto'});
      }
    }
  }
  function clear(view) {
    view.input.value=''; view.replyBody.replaceChildren(); view.reply.hidden=true;
    view.selected=null; view.clear.hidden=true;
    view.choices.forEach(function(button){button.setAttribute('aria-pressed','false');});
  }
  function applyAudience(view) {
    var band=getAgeBand(),group=band==='adult'?'adult':band==='teen'?'teen':'child',primary=primaryTopics[group],secondary=0;
    view.root.dataset.ctHelpBand=band||'unselected';
    view.choices.forEach(function(button){
      var key=button.dataset.topic,allowed=topicAllowed(key);button.hidden=!allowed;
      if(!allowed)return;
      if(primary.includes(key))view.quick.append(button);else{view.moreTopics.append(button);secondary+=1;}
    });
    view.more.hidden=secondary===0;
    view.faq.forEach(function(item){item.root.hidden=!topicAllowed(item.key);});
    if(view.selected&&adultOnlyTopics.includes(view.selected)&&band!=='adult')clear(view);
  }
  function render(view) {
    var copy=cfg.copy[locale],age=getAgeBand(),ageCopy=getAgeCopy(); view.root.lang=locale; view.root.dir=['ar','ur'].includes(locale)?'rtl':'ltr';
    view.title.textContent=view.inline?copy.faqTitle:copy.title;
    view.intro.textContent=copy.intro; view.label.textContent=copy.question;
    view.input.placeholder=age!=='adult'&&ageCopy&&ageCopy.safePlaceholder?ageCopy.safePlaceholder:copy.placeholder;
    view.input.lang=locale; view.input.dir=view.root.dir;
    view.submit.textContent=copy.ask; view.privacy.textContent=copy.privacy;
    view.voice.hidden=!(copy.voiceTitle&&copy.voiceText);view.voiceTitle.textContent=copy.voiceTitle||'';view.voiceText.textContent=copy.voiceText||'';
    view.voiceNote.textContent=copy.voiceNote||'';view.hasClear=typeof copy.clear==='string'&&!!copy.clear.trim();view.clear.textContent=view.hasClear?copy.clear:'';if(!view.hasClear)view.clear.hidden=true;
    view.examples.textContent=copy.examplesLabel||copy.faqTitle; view.moreTitle.textContent=ageCopy&&ageCopy.moreTopics?ageCopy.moreTopics:copy.faqTitle; view.updated.textContent=copy.updatedLabel||'';view.updated.hidden=!copy.updatedLabel;
    view.choices.forEach(function(button){button.textContent=copy.topics[button.dataset.topic].title;});
    view.faq.forEach(function(item){item.title.textContent=copy.topics[item.key].title;bodyContent(item.body,topicData(item.key),copy);});
    applyAudience(view);
    if(!view.reply.hidden) answer(view,view.selected);
  }
  function make(inline) {
    var root=el('section',null,inline?'ctstyle-discovery-card ctstyle-faq-hub':'ctstyle-help-widget');
    root.id=inline?'ctstyle-faq-help':'ctstyle-widget-help';
    var header=el('header',null,'ctstyle-help-header'), title=el('h2'), picture=avatar();
    title.id=root.id+'-title'; root.setAttribute('aria-labelledby',title.id);
    if(picture)header.append(picture);header.append(title);
    var intro=el('p'),form=el('form',null,'ctstyle-help-form'),label=el('label'),input=el('input'),submit=el('button',null,'ctstyle-discovery-action');
    input.id=root.id+'-question';input.type='text';input.maxLength=160;input.autocomplete='off';
    input.setAttribute('spellcheck','true');input.setAttribute('inputmode','text');
    input.setAttribute('autocapitalize','sentences');input.setAttribute('enterkeyhint','search');
    label.htmlFor=input.id;submit.type='submit';form.append(label,input,submit);
    // No action, field name, raw-question echo, history, persistence, analytics or provider call.
    var examples=el('h3'),quick=el('div',null,'ctstyle-help-topics ctstyle-help-topics-primary'),choices=[];
    visibleTopics.filter(function(key){return cfg.copy[locale].topics[key];}).forEach(function(key){var b=el('button');b.type='button';b.dataset.topic=key;b.setAttribute('aria-pressed','false');quick.append(b);choices.push(b);});
    var more=el('details',null,'ctstyle-help-more'),moreTitle=el('summary'),moreTopics=el('div',null,'ctstyle-help-topics ctstyle-help-topics-secondary');more.append(moreTitle,moreTopics);
    var reply=el('div',null,'ctstyle-help-reply'),replyTitle=el('h3'),replyBody=el('div'),reset=el('button',null,'ctstyle-help-clear');
    reply.hidden=true;reply.setAttribute('role','status');reply.setAttribute('aria-live','polite');reset.type='button';reset.hidden=true;
    reply.append(replyTitle,replyBody);reset.addEventListener('click',function(){clear(view);input.focus();});
    var voice=el('details',null,'ctstyle-help-voice'),voiceTitle=el('summary'),voiceText=el('p'),voiceNote=el('p',null,'ctstyle-discovery-small');
    voice.append(voiceTitle,voiceText,voiceNote);
    var privacy=el('p',null,'ctstyle-discovery-small'),updated=el('p',null,'ctstyle-help-updated');
    root.append(header,intro,form,reply,reset,examples,quick,more,voice,privacy,updated);
    var faq=[];
    if(inline) visibleTopics.filter(function(key){return cfg.copy[locale].topics[key];}).forEach(function(key){
      var details=el('details',null,'ctstyle-faq-item'),summary=el('summary'),body=el('div');details.dataset.topic=key;
      details.append(summary,body);root.append(details);faq.push({key:key,root:details,title:summary,body:body});
    });
    var view={root:root,title:title,intro:intro,label:label,input:input,submit:submit,privacy:privacy,
      reply:reply,replyTitle:replyTitle,replyBody:replyBody,clear:reset,choices:choices,faq:faq,inline:inline,selected:null,
      voice:voice,voiceTitle:voiceTitle,voiceText:voiceText,voiceNote:voiceNote,examples:examples,quick:quick,hasClear:false,
      more:more,moreTitle:moreTitle,moreTopics:moreTopics,updated:updated};
    form.addEventListener('submit',function(event){event.preventDefault();if(!allowed())return;var key=topic(input.value);input.value='';answer(view,key,true);});
    choices.forEach(function(button){button.addEventListener('click',function(){if(!allowed())return;input.value='';answer(view,button.dataset.topic,true);});});
    views.push(view);render(view);return root;
  }
  function refresh(tag) {
    if (!allowed()) return;
    var chosen=resolveLocale(tag) || resolveLocale(window.CalorieTokenDiscoveryUI && window.CalorieTokenDiscoveryUI.getLocale()) || resolveLocale(document.documentElement.lang);
    if (chosen) locale=chosen;
    var panels=document.querySelectorAll('#ctstyle-app-launcher .ctstyle-app-launcher-panel');
    if (panels.length===1 && !panels[0].querySelector('#ctstyle-widget-help')) {
      var help=make(false);panels[0].prepend(help);
      var picker=panels[0].querySelector('#ctstyle-language-select');
      var pickerLabel=panels[0].querySelector('label[for="ctstyle-language-select"]');
      if(picker&&pickerLabel){var language=el('div',null,'ctstyle-help-language');language.append(pickerLabel,picker);help.querySelector('.ctstyle-help-header').after(language);}
      var icon=document.querySelector('#ctstyle-app-launcher .ctstyle-help-icon'),picture=avatar();
      if(icon&&picture){icon.replaceChildren(picture);icon.classList.add('ctstyle-help-mascot');}
    }
    if (Number(cfg.page)===6855 && !document.getElementById('ctstyle-faq-help')) {
      var titles=document.querySelectorAll('.ctstyle-title');
      if(titles.length===1 && !titles[0].closest(protectedArea)) {
        var anchor=titles[0].closest('.brz-section') || titles[0];
        if(!anchor.closest(protectedArea)) anchor.after(make(true));
      }
    }
    views.forEach(render);
  }
  window.CalorieTokenHelpUI={refresh:refresh};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){refresh();},{once:true});else refresh();
  window.addEventListener('load',function(){refresh();},{once:true});
  document.addEventListener('calorietoken:display-language',function(event){if(event.detail)refresh(event.detail.locale);});
  window.addEventListener('pagehide',function(){views.forEach(clear);});
})();
