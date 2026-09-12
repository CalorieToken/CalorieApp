/* Calorie help: fixed first-party answers, processed on this page. GPL-2.0-or-later. */
(function () {
  'use strict';
  var cfg = window.CalorieTokenHelp;
  if (!cfg || !cfg.copy || window.CalorieTokenHelpUI) return;
  var views = [], locale = 'en';
  var visibleTopics = ['app','test','exchange','donations','trustline','docs','history','troubleshoot','legal'];
  var protectedArea = 'form,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],[hidden],[inert]';
  var routes = {
    app:['CalorieApp','/index.php/calorieapp/'], test:['XRPL Testnet','/index.php/calorieapp/#ctstyle-testnet'],
    faq:['FAQ','/index.php/faq/'], trustline:['CAL Trustline','/index.php/trustline/'],
    exchange:['CAL & Crypto','/index.php/how-to-buy-calorie/'], privacy:['Privacy Policy','/index.php/privacy-policy/'],
    terms:['Terms & Conditions','/index.php/terms-conditions/'], contact:['Contact','/index.php/contact/'],
    docs:['GitHub · Publications','https://github.com/CalorieToken/Publications'],
    whitepaper:['Whitepaper','https://github.com/CalorieToken/Publications/blob/main/whitepaper/CalorieToken-Whitepaper.pdf'],
    roadmap:['Roadmap Explained','https://github.com/CalorieToken/Publications/blob/main/roadmap/README.md'],
    archives:['Whitepaper archive','https://github.com/CalorieToken/Publications/blob/main/whitepaper/archive/README.md'],
    history:['Roadmap archive','https://github.com/CalorieToken/Publications/blob/main/roadmap/archive/README.md'],
    appSource:['GitHub · CalorieApp','https://github.com/CalorieToken/CalorieApp'],
    donations:['Donations','/donate/'],
    donationWallet:['Bithomp · XRP','https://bithomp.com/explorer/rEfiRssDCQd466z2bi63vi64u2rYiMrnhL'],
    xaman:['Xaman · Testnet','https://help.xaman.app/app/learning-more-about-xaman/how-to-access-testnet-on-xrp-ledger']
  };
  var keywords = {
    donations:['donation','donations','donate','donatie','donaties','doneren','donation balance','donatiesaldo','consolidation','consolidatie','捐赠','दान','تبرع','অনুদান','donación','donaciones','dons','donativos','donasi','عطیات'],
    test:['test','testnet','faucet','proberen','oefenen','testaccount','测试','परीक्ष','اختبار','পরীক্ষা','آزمائش','uji'],
    trustline:['trustline','trust set','issuer','uitgever','hex','信任','ट्रस्ट','ثقة','ট্রাস্ট','ٹرسٹ'],
    exchange:['exchange','swft','dex','kopen','verkopen','wisselen','buy','sell','swap','bitcoin','btc','eth','兑换','खरीद','شراء','বিনিময়','trocar','tukar','خرید'],
    legal:['privacy','licence','license','licentie','legal','juridisch','mica','cookie','terms','voorwaarden','copyright','disclosure','garantie','profit','rendement','隐私','गोपनीय','خصوص','গোপনীয়','privacidade','lisensi','شرائط'],
    docs:['roadmap','whitepaper','documents','documenten','publication','publicatie','usda','bron','source','路线','दस्तावेज़','وثائق','নথি','dokumen','دستاویز'],
    app:['calorieapp','food','voeding','dagboek','login','logout','aanmelden','inloggen','uitloggen','diary','portion','portie','食品','भोजन','طعام','খাবার','alimento','makanan','کھانا'],
    history:['history','historie','geschiedenis','oorsprong','origins','2021','历史','इतिहास','historia','تاريخ','histoire','ইতিহাস','história','sejarah','تاریخ'],
    troubleshoot:['laden','laadt','loading','load','blank','leeg','cookies','iframe','embed','werkt niet','werktniet','scroll','麦克','加载','लोड','carga','تحميل','charge','লোড','carrega','muat','لوڈ'],
    voice:['microphone','microfoon','dictation','dicteren','voice','spraak','micrófono','micrófone','microfone','voix','suara','语音','आवाज़','الصوت','কথা','آواز'],
    contact:['contact','support','email','e-mail','ticket','contacto','联系','संपर्क','اتصال','যোগাযোগ','contato','kontak','رابطہ']
  };
  function allowed() {
    return document.body && document.body.matches('.ctstyle-enabled,.ctstyle-footer-only') &&
      !document.body.matches('.page-id-8001,.brz-ed') && !document.querySelector('.brz-ed,#brz-ed-iframe,[contenteditable="true"]') &&
      ['https://calorietoken.net','https://www.calorietoken.net'].includes(window.location.origin) &&
      !/\/wp-admin\//.test(window.location.pathname) &&
      Array.from(new URL(window.location.href).searchParams.keys()).every(function (key) { return key === 'ui_lang'; });
  }
  function el(tag,text,cls) { var node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; }
  function link(id) {
    var route=routes[id], a=el('a',route[0],'ctstyle-help-link');
    a.href=route[1].startsWith('/') ? window.location.origin+route[1] : route[1];
    if (!route[1].startsWith('/')) { a.target='_blank'; a.rel='noopener noreferrer'; }
    return a;
  }
  function topic(query) {
    var text=String(query||'').slice(0,160).normalize('NFKC').toLowerCase().trim();
    if (!text) return null;
    var candidates=Object.keys(keywords).filter(function (key) {
      return keywords[key].some(function (word) {
        if (/^[a-z0-9 -]+$/.test(word)) return new RegExp('(?:^|[^a-z0-9])'+word.replace(/ /g,'\\s+')+'(?:$|[^a-z0-9])','i').test(text);
        return text.includes(word);
      }) || text === (cfg.copy[locale].topics[key]?.title || cfg.copy[locale].voiceTitle).normalize('NFKC').toLowerCase();
    });
    // Contact is returned only when explicitly requested, never as a failure path.
    if (candidates.includes('legal') && !candidates.includes('troubleshoot')) return 'legal';
    if (candidates.includes('test')) return 'test';
    return candidates.length===1 ? candidates[0] : null;
  }
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
    var sources=el('div',null,'ctstyle-help-links');
    (data.links || []).forEach(function(id){if(routes[id])sources.append(link(id));});
    if(sources.childNodes.length) container.append(el('p',copy.sourcesLabel,'ctstyle-help-source-label'),sources);
  }
  function answer(view,key) {
    view.selected=key; var copy=cfg.copy[locale], data=copy.topics[key];
    if(key==='voice') data={title:copy.voiceTitle,text:copy.voiceText+' '+copy.voiceNote,links:[]};
    view.replyTitle.textContent=data?data.title:copy.examplesLabel;
    bodyContent(view.replyBody,data || {text:copy.unknown,links:['faq','docs']},copy);
    view.reply.hidden=false; view.clear.hidden=false;
    view.choices.forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.topic===key));});
  }
  function clear(view) {
    view.input.value=''; view.replyBody.replaceChildren(); view.reply.hidden=true;
    view.selected=null; view.clear.hidden=true;
    view.choices.forEach(function(button){button.setAttribute('aria-pressed','false');});
  }
  function render(view) {
    var copy=cfg.copy[locale]; view.root.lang=locale; view.root.dir=['ar','ur'].includes(locale)?'rtl':'ltr';
    view.title.textContent=view.inline?copy.faqTitle:copy.title;
    view.intro.textContent=copy.intro; view.label.textContent=copy.question; view.input.placeholder=copy.placeholder;
    view.input.lang=locale; view.input.dir=view.root.dir;
    view.submit.textContent=copy.ask; view.privacy.textContent=copy.privacy;
    view.voiceTitle.textContent=copy.voiceTitle; view.voiceText.textContent=copy.voiceText;
    view.voiceNote.textContent=copy.voiceNote; view.clear.textContent=copy.clear;
    view.examples.textContent=copy.examplesLabel; view.updated.textContent=copy.updatedLabel;
    view.choices.forEach(function(button){button.textContent=copy.topics[button.dataset.topic].title;});
    view.faq.forEach(function(item){item.title.textContent=copy.topics[item.key].title;bodyContent(item.body,copy.topics[item.key],copy);});
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
    var examples=el('h3'),quick=el('div',null,'ctstyle-help-topics'),choices=[];
    visibleTopics.forEach(function(key){var b=el('button');b.type='button';b.dataset.topic=key;b.setAttribute('aria-pressed','false');quick.append(b);choices.push(b);});
    var reply=el('div',null,'ctstyle-help-reply'),replyTitle=el('h3'),replyBody=el('div'),reset=el('button',null,'ctstyle-help-clear');
    reply.hidden=true;reply.setAttribute('role','status');reply.setAttribute('aria-live','polite');reset.type='button';reset.hidden=true;
    reply.append(replyTitle,replyBody);reset.addEventListener('click',function(){clear(view);input.focus();});
    var voice=el('details',null,'ctstyle-help-voice'),voiceTitle=el('summary'),voiceText=el('p'),voiceNote=el('p',null,'ctstyle-discovery-small');
    voice.append(voiceTitle,voiceText,voiceNote);
    var privacy=el('p',null,'ctstyle-discovery-small'),updated=el('p',null,'ctstyle-help-updated');
    root.append(header,intro,form,reply,reset,examples,quick,voice,privacy,updated);
    var faq=[];
    if(inline) visibleTopics.forEach(function(key){
      var details=el('details',null,'ctstyle-faq-item'),summary=el('summary'),body=el('div');
      details.append(summary,body);root.append(details);faq.push({key:key,title:summary,body:body});
    });
    var view={root:root,title:title,intro:intro,label:label,input:input,submit:submit,privacy:privacy,
      reply:reply,replyTitle:replyTitle,replyBody:replyBody,clear:reset,choices:choices,faq:faq,inline:inline,selected:null,
      voiceTitle:voiceTitle,voiceText:voiceText,voiceNote:voiceNote,examples:examples,updated:updated};
    form.addEventListener('submit',function(event){event.preventDefault();if(!allowed())return;var key=topic(input.value);input.value='';answer(view,key);});
    choices.forEach(function(button){button.addEventListener('click',function(){if(!allowed())return;input.value='';answer(view,button.dataset.topic);});});
    views.push(view);render(view);return root;
  }
  function refresh(tag) {
    if (!allowed()) return;
    var chosen=tag || (window.CalorieTokenDiscoveryUI && window.CalorieTokenDiscoveryUI.getLocale()) || document.documentElement.lang;
    if (cfg.copy[chosen]) locale=chosen;
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
