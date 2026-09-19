/* CalorieToken Site Style — observed public-page corrections. GPL-2.0-or-later. */
(function () {
  'use strict';
  if (window.CalorieTokenRefinements || !window.CalorieTokenDiscovery) return;
  var cfg=window.CalorieTokenDiscovery, locale='en', labels=[], observer=null, pending=false, menuBindings=new WeakSet();
  var blocked='form,[contenteditable],.xl-card,[data-calorieapp-embed],.ctstyle-title,.ctstyle-header,header,footer,template';
  var dex='https://xpmarket.com/dex/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP';
  var swap='https://xpmarket.com/swap/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP/market';
  var oldDex='https://xumm.app/detect/xapp:xumm.dex?base=43616C6F72696500000000000000000000000000+rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY&quote=xrp';
  function allowed(){return document.body && document.body.matches('.ctstyle-enabled,.ctstyle-footer-only') && !document.body.matches('.page-id-8001,.brz-ed') && !document.querySelector('.brz-ed,#brz-ed-iframe') && ['https://calorietoken.net','https://www.calorietoken.net'].includes(window.location.origin) && !/\/wp-admin\//.test(window.location.pathname) && !Array.from(new URL(window.location.href).searchParams.keys()).some(function(k){return /^(?:preview|customize_changeset_uuid|brizy-edit|brizy-edit-iframe|brz-edit|brz-edit-iframe|xl-)/.test(k);});}
  function one(selector){var n=document.querySelectorAll(selector);return n.length===1?n[0]:null;}
  function text(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function make(tag,cls,copy){var n=document.createElement(tag);if(cls)n.className=cls;if(copy)n.textContent=copy;return n;}
  function label(tag,key,cls){var n=make(tag,cls,cfg.copy.en[key]);labels.push({node:n,key:key});return n;}
  function routes(){
    document.querySelectorAll('.xl-card a[href]').forEach(function(a){
      if(a.getAttribute('href')===oldDex)a.href=window.location.origin+'/index.php/how-to-buy-calorie/';
      if(a.getAttribute('href')===window.location.origin+'/index.php/how-to-buy-calorie/' && a.getAttribute('title')==='Trade on the XUMM DEX xApp!')a.removeAttribute('title');
    });
    if(Number(cfg.page)!==4205)return;
    var guide=one('.cal-buy-guide[data-calorieapp-buy-guide="1"]');if(!guide||guide.closest(blocked))return;
    var trade=guide.querySelector('a[data-cal-buy-copy="tradeAction"]');
    if(trade&&trade.getAttribute('href')==='https://xpmarket.com/token/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY')trade.href=dex;
    guide.querySelectorAll('section.cal-buy-own-dex').forEach(function(section){
      var links=Array.from(section.querySelectorAll('a'));
      if(links.length!==3||links[0].href!=='https://sologenic.org/'||links[1].href!==oldDex||links[2].href!=='https://www.xrptoolkit.com/')return;
      // Only the old, exact provider list. Never rewrite a custom destination.
      links[0].href=dex;links[0].textContent='Open CAL/XRP order book';links[0].setAttribute('data-cal-buy-copy','dexAlternative');
      links[1].href=swap;links[1].textContent='Swap CAL/XRP';links[1].setAttribute('data-cal-buy-copy','swapAlternative');
      var sep=links[2].previousSibling;if(sep&&sep.nodeType===3&&/^[\s·]*$/.test(sep.data))sep.remove();links[2].remove();
    });
    if(guide.querySelectorAll('a').length===7 && guide.querySelector('a[href="'+dex+'"]') && guide.querySelector('a[href="'+swap+'"]'))guide.setAttribute('data-ctstyle-buy-routes','1');
    if(window.CalorieTokenPageLanguage)window.CalorieTokenPageLanguage.refresh();
  }
  function paper(){
    // One document background. Retire only the two observed faded-paper assets;
    // colourful header, historical illustrations and Home title artwork stay intact.
    document.querySelectorAll('.brz-bg-image').forEach(function(n){
      if(n.closest('.ctstyle-header,header,.ctstyle-title,.ctstyle-title-section,.ctstyle-footer,footer,template'))return;
      var image=window.getComputedStyle(n).backgroundImage||'';
      if(!/\/(?:Websiteachtergrond|FadedAchtergrondCalorie)(?:-\d+x\d+)?\.png(?:["')?]|$)/i.test(image))return;
      n.classList.add('ctstyle-paper-layer');
      if(n.parentElement&&n.parentElement.matches('.brz-bg')){
        n.parentElement.classList.add('ctstyle-paper-host');
        n.parentElement.querySelectorAll(':scope > .brz-bg-color').forEach(function(c){c.classList.add('ctstyle-paper-tint');});
      }
      document.body.classList.add('ctstyle-paper-continuous');
    });
  }
  function trustline(){
    if(Number(cfg.page)!==1205)return;
    var native=one('#ctstyle-direct-trustline'), options=one('.ctstyle-trustline-options');
    if(native&&options&&!document.getElementById('ctstyle-trustline-methods')){
      var host=make('div','ctstyle-trustline-methods');host.id='ctstyle-trustline-methods';
      options.before(host);host.append(native,options);
      native.prepend(label('p','directRoute','ctstyle-route-label'));
      var toolkit=one('[data-brz-custom-id="tudwxqvkogbjptwlykgwzlzdixbhxidyqhku"]');
      if(toolkit&&options.contains(toolkit)){
        var details=make('details','ctstyle-manual-trustline');details.id='ctstyle-manual-trustline';
        toolkit.before(details);details.append(label('summary','manualRoute'),toolkit);
      }
    }
    var external=one('[data-brz-custom-id="inpxenkjojstawbfbmiwkgigeabgzzcmectb"]');
    if(options&&external&&options.contains(external)&&!external.closest('.ctstyle-external-trustline')){
      var alternate=make('details','ctstyle-manual-trustline ctstyle-external-trustline');
      var priorLabel=external.querySelector(':scope > .ctstyle-route-label');if(priorLabel)priorLabel.remove();
      external.before(alternate);alternate.append(label('summary','externalRoute'),external);
    }
    var root=one('[data-brz-custom-id="nrsbytvlhdquaddotxqmaeiihmzfbcufpmhr"]');
    if(root&&root.querySelectorAll('[data-calorieapp-trustline-ui] .calorieapp-copy-button[aria-describedby]').length===2 && root.querySelectorAll('.calorieapp-copy-button:not([aria-describedby])').length===2)root.classList.add('ctstyle-copy-dedup');
  }
  function roadmap(){
    if(!/\/(?:index.php\/)?roadmap\/$/.test(window.location.pathname))return;
    var explained=one('[data-brz-custom-id="kdpxkiwkssgeeayvskldlkfcrdkkjbksikao"]');
    var destination='https://github.com/CalorieToken/Publications/blob/main/roadmap/README.md';
    if(explained&&!explained.closest(blocked)){
      var button=explained.querySelector('a[href="'+destination+'"]');
      if(button&&button.querySelector('img[title="roadmapexplainedknop2"]')&&!button.classList.contains('ctstyle-roadmap-link')){
        explained.classList.add('ctstyle-roadmap-link-host');
        var wrap=explained.closest('.brz-wrapper');if(wrap)wrap.classList.add('ctstyle-roadmap-link-wrap');
        button.classList.add('ctstyle-roadmap-link');
        button.append(label('span','roadmapRead'));
        button.removeAttribute('aria-label');
      }
    }
    var timeline=one('[data-brz-custom-id="fywltezyscgeklkmjuvcoesosmptkgaloptn"].brz-timeline__tabs');
    if(timeline)timeline.classList.add('ctstyle-roadmap-timeline');
    var video=one('[data-brz-custom-id="nuyzubccqediuokhizydlyfagzwueddoqrnd"]');
    if(!video||video.closest(blocked)||!video.querySelector('[data-src*="youtube.com/embed/a5mwDKsWrA8"]'))return;
    if(document.getElementById('ctstyle-roadmap-preview'))return;
    var card=make('section','ctstyle-roadmap-preview');card.id='ctstyle-roadmap-preview';
    var logo=make('img');logo.src=cfg.appLogo;logo.alt='';logo.width=48;logo.height=48;
    card.append(logo,make('h3',null,'CalorieApp'),label('p','appPitch'));
    var app=label('a','openApp','ctstyle-discovery-action');app.href=cfg.appURL;
    var history=label('a','historicalVideo','ctstyle-video-history');history.href='https://www.youtube.com/watch?v=a5mwDKsWrA8';history.target='_blank';history.rel='noopener noreferrer';
    card.append(app,history);video.replaceWith(card);
  }
  function faq(){
    if(Number(cfg.page)!==6855)return;
    var root=one('[data-brz-custom-id="pihyodsxhnntzvxybizaduydfjxbevlspknu"]');
    if(!root||root.closest(blocked))return;
    var inner=root.querySelector(':scope > [data-brz-translate-text]');
    if(inner&&!root.classList.contains('ctstyle-faq-copy')){
      var children=Array.from(inner.children), questions=children.filter(function(n){return n.tagName==='P'&&/\?$/.test(text(n.textContent));});
      if(questions.length===11&&children.every(function(n){return n.tagName==='P'&&!n.querySelector('a,button,input,img,iframe');})){
        var current=null;children.forEach(function(n){
          if(questions.includes(n)){
            current=make('details','ctstyle-faq-item');var summary=make('summary');
            while(n.firstChild)summary.append(n.firstChild);current.append(summary);n.replaceWith(current);
          }else if(current)current.append(n);
        });root.classList.add('ctstyle-faq-copy');
      }
    }
    var help=one('#ctstyle-faq-help');if(help&&!root.contains(help)&&root.previousElementSibling!==help)root.before(help);
  }
  function contact(){
    if(Number(cfg.page)!==1213)return;
    var team=one('.ctstyle-contact-team');if(!team)return;
    team.classList.add('ctstyle-team-flow');
    var market=one('[data-brz-custom-id="qnfxijkgbfdhagolgnoklsbijcstdnpoowkg"]');
    if(market&&market.querySelector('.ctstyle-market-card')&&!team.contains(market)){
      market.classList.add('ctstyle-after-team');
      if(market.parentElement===team.parentElement)team.parentElement.classList.add('ctstyle-team-container');
    }
  }
  function homeMenu(){
    if(!document.body.matches('.home.ctstyle-footer-only,.page-id-1090.ctstyle-footer-only'))return;
    ['vzcdxvzyscymovatjslzsgqaarqlecarnfro','tirkcgzevvwvvoohirqhwhjxmgrflwjgoyrc'].forEach(function(id){
      var n=one('[data-brz-custom-id="'+id+'"]');
      if(n&&n.matches('.brz-columns')&&!n.querySelector('.xl-card'))n.classList.add('ctstyle-home-panel');
    });
    var menu=one('.brz-menu-simple'),header=menu&&menu.closest('.brz-section');
    if(header)header.classList.add('ctstyle-native-header');
  }
  function sharedLayout(){
    // Style the existing columns without replacing menus or account nodes.
    if(document.body.matches('.ctstyle-enabled,.ctstyle-footer-only')){
      var header=one('.ctstyle-header,.ctstyle-native-header');
      if(header){
        var menu=header.querySelector('.brz-menu-simple'),logo=header.querySelector('img[src*="C-Logotranspa"]');
        var toggle=menu&&menu.querySelector('.brz-menu-simple__toggle>.brz-input[type="checkbox"]');
        if(toggle){
          toggle.setAttribute('aria-label',cfg.copy[locale].menuLabel);
          var nativeLabel=toggle.nextElementSibling;
          if(nativeLabel&&nativeLabel.matches('.brz-menu-simple__icon')&&nativeLabel.getAttribute('for')===toggle.id){
            toggle.setAttribute('aria-expanded',String(toggle.checked));
            if(!menuBindings.has(toggle)){
              menuBindings.add(toggle);
              toggle.addEventListener('change',function(){toggle.setAttribute('aria-expanded',String(toggle.checked));});
              menu.addEventListener('keydown',function(event){
                if(event.key!=='Escape'||!toggle.checked)return;
                event.preventDefault();toggle.checked=false;
                toggle.dispatchEvent(new window.Event('change',{bubbles:true}));toggle.focus();
              });
            }
          }
        }
        // Mark only known same-site navigation links; never touch account actions.
        header.querySelectorAll('.brz-menu-simple a,.ctstyle-header-nav a').forEach(function(a){
          try {var target=new URL(a.href,window.location.href);
            if(target.origin===window.location.origin&&target.pathname===window.location.pathname&&!target.hash&&!target.search)a.setAttribute('aria-current','page');
          } catch(_) { /* Keep an unrecognized native link. */ }
        });
        var fallbackMenu=header.querySelector('details.ctstyle-mobile-nav');
        if(fallbackMenu){var fallbackSummary=fallbackMenu.querySelector('summary');if(fallbackSummary)fallbackSummary.setAttribute('aria-label',cfg.copy[locale].menuLabel);}
        if(fallbackMenu&&!menuBindings.has(fallbackMenu)){
          menuBindings.add(fallbackMenu);
          fallbackMenu.addEventListener('keydown',function(event){
            if(event.key!=='Escape'||!fallbackMenu.open)return;
            event.preventDefault();fallbackMenu.open=false;
            var summary=fallbackMenu.querySelector('summary');if(summary)summary.focus();
          });
        }
        var menuCol=menu&&menu.closest('.brz-columns'),logoCol=logo&&logo.closest('.brz-columns');
        if(menuCol&&logoCol&&menuCol!==logoCol&&menuCol.parentElement===logoCol.parentElement){
          var row=menuCol.parentElement,cards=Array.from(row.children).filter(function(n){return n.querySelector('.xl-card');});
          if(row.matches('.brz-row')&&row.children.length===3&&cards.length===1&&cards[0]!==menuCol&&cards[0]!==logoCol){
            header.classList.add('ctstyle-compact-header');row.classList.add('ctstyle-header-grid');
            menuCol.classList.add('ctstyle-menu-column');logoCol.classList.add('ctstyle-logo-column');cards[0].classList.add('ctstyle-account-column');
          }
        }
        if(header.classList.contains('ctstyle-header-fallback'))header.classList.add('ctstyle-widget-reference');
      }
    }
    var footer=one('.ctstyle-footer');
    if(footer){
      if(!footer.querySelector('.ctstyle-footer-cookies')){
        var links=footer.querySelector('.ctstyle-legal-links');
        if(links){var cookies=label('button','cookies','ctstyle-footer-cookies cmplz-manage-consent');cookies.type='button';links.append(cookies);}
      }
      if(!document.querySelector('.ctstyle-footer-tail')){
        var tail=make('div','ctstyle-footer-tail');tail.setAttribute('aria-hidden','true');footer.after(tail);
      }
      var siblings=Array.from(footer.parentElement.children),after=siblings.slice(siblings.indexOf(footer)+1);
      after.forEach(function(section){
        if(!section.matches('.brz-section')||section.querySelector('img,a,button,form,iframe,video')||text(section.textContent))return;
        section.querySelectorAll('.brz-bg-image').forEach(function(n){
          if(/\/(?:Caloriefoto2(?:-\d+x\d+)?\.jpg|achtergrondbannersitea1\.png)(?:["')?]|$)/i.test(window.getComputedStyle(n).backgroundImage||''))section.classList.add('ctstyle-replaced-empty-tail');
        });
      });
    }
  }
  function refresh(tag){
    if(!allowed())return;if(observer)observer.disconnect();
    locale=cfg.copy[tag]?tag:(window.CalorieTokenDiscoveryUI?window.CalorieTokenDiscoveryUI.getLocale():'en');
    routes();paper();trustline();roadmap();faq();contact();homeMenu();sharedLayout();
    labels.forEach(function(x){var value=cfg.copy[locale][x.key];if(x.node.textContent!==value)x.node.textContent=value;x.node.lang=locale;x.node.dir=['ar','ur'].includes(locale)?'rtl':'ltr';});
    if(observer)observer.observe(document.body,{childList:true,subtree:true});
  }
  window.CalorieTokenRefinements={refresh:refresh};
  if(typeof window.MutationObserver==='function')observer=new window.MutationObserver(function(records){
    if(pending||!records.some(function(r){return Array.from(r.addedNodes).some(function(n){return n.nodeType===1&&!n.closest?.('#ctstyle-faq-help,#ctstyle-widget-help');});}))return;
    pending=true;window.requestAnimationFrame(function(){pending=false;refresh();});
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){refresh();},{once:true});else refresh();
  window.addEventListener('load',function(){refresh();},{once:true});
  document.addEventListener('calorietoken:display-language',function(e){refresh(e.detail&&e.detail.locale);});
  window.addEventListener('pagehide',function(){if(observer)observer.disconnect();});
  window.addEventListener('pageshow',function(){refresh();});
})();
