/* Calorie help: fixed first-party answers, processed on this page. GPL-2.0-or-later. */
(function () {
  'use strict';
  var cfg = window.CalorieTokenHelp;
  if (!cfg || !cfg.copy || window.CalorieTokenHelpUI) return;
  var views = [], locale = 'en';
  var protectedArea = 'form,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],[hidden],[inert]';
  var routes = {
    app:['CalorieApp','/index.php/calorieapp/'], test:['XRPL Testnet','/index.php/calorieapp/#ctstyle-testnet'],
    faq:['FAQ','/index.php/faq/'], trustline:['CAL Trustline','/index.php/trustline/'],
    exchange:['CAL & Crypto','/index.php/how-to-buy-calorie/'], privacy:['Privacy Policy','/index.php/privacy-policy/'],
    terms:['Terms & Conditions','/index.php/terms-conditions/'], contact:['Contact','/index.php/contact/'],
    docs:['GitHub · Publications','https://github.com/CalorieToken/Publications'],
    whitepaper:['Whitepaper','https://github.com/CalorieToken/Publications/blob/main/whitepaper/CalorieToken-Whitepaper.pdf'],
    roadmap:['Roadmap Explained','https://github.com/CalorieToken/Publications/blob/main/roadmap/README.md'],
    xaman:['Xaman · Testnet','https://help.xaman.app/app/learning-more-about-xaman/how-to-access-testnet-on-xrp-ledger']
  };
  var keywords = {
    test:['test','testnet','faucet','proberen','oefenen','testaccount','测试','परीक्ष','اختبار','পরীক্ষা','آزمائش','uji'],
    trustline:['trustline','trust set','issuer','uitgever','hex','信任','ट्रस्ट','ثقة','ট্রাস্ট','ٹرسٹ'],
    exchange:['exchange','swft','dex','kopen','verkopen','wisselen','buy','sell','swap','bitcoin','btc','eth','兑换','खरीद','شراء','বিনিময়','trocar','tukar','خرید'],
    legal:['privacy','licence','license','licentie','legal','juridisch','mica','cookie','terms','voorwaarden','copyright','disclosure','garantie','profit','rendement','隐私','गोपनीय','خصوص','গোপনীয়','privacidade','lisensi','شرائط'],
    docs:['roadmap','whitepaper','documents','documenten','publication','publicatie','usda','bron','source','路线','दस्तावेज़','وثائق','নথি','dokumen','دستاویز'],
    app:['calorieapp','food','voeding','dagboek','login','logout','aanmelden','inloggen','uitloggen','diary','portion','portie','食品','भोजन','طعام','খাবার','alimento','makanan','کھانا'],
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
      }) || text === cfg.copy[locale].topics[key].title.normalize('NFKC').toLowerCase();
    });
    // Contact is returned only when explicitly requested, never as a failure path.
    if (candidates.includes('legal')) return 'legal';
    if (candidates.includes('test')) return 'test';
    return candidates.length===1 ? candidates[0] : null;
  }
  function answer(view,key) {
    view.selected=key; var copy=cfg.copy[locale], data=copy.topics[key];
    view.reply.replaceChildren(el('p',data ? data.text : copy.unknown));
    var links=el('div',null,'ctstyle-help-links');
    (data ? data.links : ['faq','docs']).forEach(function (id) { links.append(link(id)); });
    view.reply.append(links); view.reply.hidden=false;
  }
  function render(view) {
    var copy=cfg.copy[locale]; view.root.lang=locale; view.root.dir=['ar','ur'].includes(locale)?'rtl':'ltr';
    view.title.textContent=view.inline?copy.faqTitle:copy.title;
    view.intro.textContent=copy.intro; view.label.textContent=copy.question; view.input.placeholder=copy.placeholder;
    view.submit.textContent=copy.ask; view.privacy.textContent=copy.privacy;
    view.choices.forEach(function (button) { button.textContent=copy.topics[button.dataset.topic].title; });
    view.faq.forEach(function (item) { item.title.textContent=copy.topics[item.key].title; item.body.textContent=copy.topics[item.key].text; });
    if (!view.reply.hidden) answer(view,view.selected);
  }
  function make(inline) {
    var root=el(inline?'section':'details',null,inline?'ctstyle-discovery-card ctstyle-faq-hub':'ctstyle-help-widget');
    root.id=inline?'ctstyle-faq-help':'ctstyle-widget-help';
    var title=el(inline?'h2':'summary'), intro=el('p'), form=el('form',null,'ctstyle-help-form'), label=el('label'), input=el('input'), submit=el('button',null,'ctstyle-discovery-action');
    input.id=root.id+'-question';input.type='search';input.maxLength=160;input.autocomplete='off';input.setAttribute('spellcheck','false');label.htmlFor=input.id;submit.type='submit';
    // No action, field name, history, persistence, analytics or provider call.
    form.append(label,input,submit);
    var quick=el('div',null,'ctstyle-help-topics'), choices=[];
    ['app','test','trustline','exchange','legal','docs'].forEach(function (key) { var b=el('button');b.type='button';b.dataset.topic=key;quick.append(b);choices.push(b); });
    var reply=el('div',null,'ctstyle-help-reply');reply.hidden=true;reply.setAttribute('role','status');reply.setAttribute('aria-live','polite');
    var privacy=el('p',null,'ctstyle-discovery-small'); root.append(title,intro,form,quick,reply,privacy);
    var faq=[];
    if (inline) ['app','test','trustline','exchange','legal','docs'].forEach(function (key) {
      var details=el('details',null,'ctstyle-faq-item'), summary=el('summary'), body=el('p'), links=el('div',null,'ctstyle-help-links');
      cfg.copy.en.topics[key].links.forEach(function (id) {links.append(link(id));});
      details.append(summary,body,links);root.append(details);faq.push({key:key,title:summary,body:body});
    });
    var view={root:root,title:title,intro:intro,label:label,input:input,submit:submit,privacy:privacy,reply:reply,choices:choices,faq:faq,inline:inline,selected:null};
    form.addEventListener('submit',function (event) {event.preventDefault();if(!allowed())return;var key=topic(input.value);input.value='';answer(view,key);});
    choices.forEach(function (button) {button.addEventListener('click',function () {if(!allowed())return;input.value='';answer(view,button.dataset.topic);});});
    views.push(view);render(view);return root;
  }
  function refresh(tag) {
    if (!allowed()) return;
    var chosen=tag || (window.CalorieTokenDiscoveryUI && window.CalorieTokenDiscoveryUI.getLocale()) || document.documentElement.lang;
    if (cfg.copy[chosen]) locale=chosen;
    var panels=document.querySelectorAll('#ctstyle-app-launcher .ctstyle-app-launcher-panel');
    if (panels.length===1 && !panels[0].querySelector('#ctstyle-widget-help')) panels[0].append(make(false));
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
  window.addEventListener('pagehide',function(){views.forEach(function(view){view.input.value='';view.reply.replaceChildren();view.reply.hidden=true;view.selected=null;});});
})();
