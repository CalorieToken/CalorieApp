/* CalorieToken Site Style — additive public presentation. GPL-2.0-or-later. */
(function () {
  'use strict';
  var cfg = window.CalorieTokenDiscovery;
  if (!cfg || window.CalorieTokenDiscoveryUI) return;
  var forbidden = 'form,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],[hidden],[inert],[aria-hidden="true"]';
  var exchangeURL = 'https://defi.swft.pro/#/?sourceFlag=CALORIE';
  var dexURL = 'https://xpmarket.com/dex/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP';
  var helpURL = 'https://help.xaman.app/app/learning-more-about-xaman/how-to-access-testnet-on-xrp-ledger';
  var nodes = [], hub = null, launcher = null, test = null, trust = null, frame = null, controls = null, requestedLocale = null, revoked = false, picker = null, preferenceRead = false;
  var exchangeRequested = false;
  var preferenceKey = 'calorieapp.display-language.v1';
  var pickers = [], accountApp = null, accountWatcher = null, cookieWatcher = null, cookieAttributeWatcher = null;
  var menuLabels = new WeakMap();
  function allowed() {
    return document.body && document.body.matches('.ctstyle-enabled,.ctstyle-footer-only') &&
      !document.body.matches('.page-id-8001,.brz-ed') && !document.querySelector('.brz-ed,#brz-ed-iframe') &&
      (!document.body.matches('.home,.page-id-1090') || document.body.classList.contains('ctstyle-footer-only')) &&
      ['https://calorietoken.net','https://www.calorietoken.net'].includes(window.location.origin) &&
      !/\/wp-admin\//.test(window.location.pathname) &&
      Array.from(new URL(window.location.href).searchParams.keys()).every(function (key) { return key === 'ui_lang'; });
  }
  function unique(selector) { var all = document.querySelectorAll(selector); return all.length === 1 ? all[0] : null; }
  function safe(node) { return node && !node.closest(forbidden) && !node.querySelector('form,input,select,textarea,[contenteditable],.xl-card,[data-calorieapp-account],[data-calorieapp-embed],iframe'); }
  function lang() {
    var value = requestedLocale || new URL(window.location.href).searchParams.get('ui_lang') || document.documentElement.lang || 'en';
    var keys = Object.keys(cfg.copy), found = keys.find(function (key) { return key.toLowerCase() === value.toLowerCase(); });
    if (!found && /^zh(?:-|$)/i.test(value)) found = 'zh-Hans';
    return found || (cfg.copy[value.split('-')[0]] ? value.split('-')[0] : 'en');
  }
  function element(tag, className, text) {
    var node = document.createElement(tag); if (className) node.className = className;
    if (text) node.textContent = text; return node;
  }
  function label(tag, key, className) {
    var node = element(tag, className, cfg.copy.en[key]);
    nodes.push({node: node, key: key}); return node;
  }
  function link(key, url, external) {
    var node = label('a', key, 'ctstyle-discovery-action'); node.href = url;
    if (external) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    return node;
  }
  function section(id, title) {
    var node = element('section', 'ctstyle-discovery-card'); node.id = id;
    var heading = label('h2', title); heading.id = id + '-title';
    node.setAttribute('aria-labelledby', heading.id); node.append(heading); return node;
  }
  function direction(node, tag) { node.lang = tag; node.dir = ['ar','ur'].includes(tag) ? 'rtl' : 'ltr'; }
  function nativeTrustline() {
    if (!cfg.trustlineURL) return '';
    try {
      var url = new URL(cfg.trustlineURL);
      if (url.origin === window.location.origin && url.pathname === '/index.php/trustline/' &&
          url.search === '?xl-trustline' && !url.hash && !url.username && !url.password) return url.href;
    } catch (_) { /* No inferred transaction route. */ }
    return '';
  }
  function trustlineCard(id) {
    var card = section(id, 'trustTitle');
    card.append(label('p','trustText'));
    var url = nativeTrustline();
    card.append(url ? link('trustAction',url,false) : link('trustGuide',window.location.origin + '/index.php/trustline/',false));
    if (!url) card.append(label('p','trustUnavailable','ctstyle-discovery-small'));
    return card;
  }
  function consentOK() {
    // An explicit click does not override a stored CMP refusal. No consent is written.
    if (revoked) return false;
    try {
      if (typeof window.cmplz_has_service_consent === 'function') return window.cmplz_has_service_consent('swft') === true;
      if (typeof window.cmplz_has_consent === 'function') return window.cmplz_has_consent('marketing') === true;
      if (document.querySelector('.cmplz-cookiebanner,#cmplz-cookiebanner-container')) return false;
      return true; // No CMP: the disclosed load button is a one-page request for external content.
    } catch (_) { return false; }
  }
  function unload() {
    exchangeRequested = false;
    if (frame) { frame.remove(); frame = null; }
    if (controls) { controls.load.hidden = false; controls.close.hidden = true; }
  }
  function syncConsent() {
    if (!controls) return;
    var permitted = consentOK();
    if (!permitted && frame) unload();
    controls.load.disabled = !permitted;
    controls.load.hidden = !permitted || !!frame;
    controls.allow.hidden = permitted;
    if (permitted && exchangeRequested) mountExchange();
    controls.settings.hidden = permitted;
    controls.notice.hidden = permitted;
  }
  function exchangeCard() {
    var card = section('ctstyle-external-exchange','bridgeTitle');
    card.append(label('p','calInactive','ctstyle-discovery-badge'),label('h3','bridgeLead'),label('p','bridgeText'));
    var wallets=element('details','ctstyle-swft-wallets'),walletTitle=label('summary','bridgeWalletsTitle');
    var names=element('ul','ctstyle-swft-wallet-list');
    ['MetaMask','Trust Wallet','Coinbase Wallet','OKX Wallet','Bitget Wallet','Phantom','Xaman','WalletConnect'].forEach(function(name){names.append(element('li','',name));});
    wallets.append(walletTitle,names,label('p','bridgeWalletsNote','ctstyle-discovery-small'));
    card.append(wallets,label('p','bridgeAllChoices'),label('p','bridgePrivacy','ctstyle-discovery-small'));
    var load = label('button','loadExchange','ctstyle-discovery-action'), close = label('button','closeExchange','ctstyle-discovery-action');
    load.type = close.type = 'button'; close.hidden = true;
    var permit = label('button','allowExchange','ctstyle-discovery-action cmplz-accept-service');
    permit.type='button';permit.setAttribute('data-service','swft');permit.setAttribute('data-category','marketing');
    var settings = label('a','cookies','ctstyle-discovery-action ctstyle-cookie-settings');
    settings.href=window.location.origin+'/cookie-policy-eu/';
    var notice = label('p','consentNeeded','ctstyle-discovery-small');
    var area = element('div','ctstyle-exchange-frame'); area.id = 'ctstyle-swft-frame';
    load.setAttribute('aria-controls',area.id); close.setAttribute('aria-controls',area.id);
    var actions = element('div','ctstyle-discovery-actions'); actions.append(permit,load,close,settings,link('openProvider',exchangeURL,true));
    card.append(actions,notice,area,label('p','providerFallback','ctstyle-discovery-small'));
    var route=element('details','ctstyle-swft-route'), routeTitle=label('summary','bridgeRouteTitle'),steps=element('ol','ctstyle-help-steps');
    ['bridgeStep1','bridgeStep2','bridgeStep3'].forEach(function(key){steps.append(label('li',key));});
    route.append(routeTitle,steps,link('openDex',dexURL,true));card.append(route);
    var sources=element('p','ctstyle-discovery-small');sources.append(link('bridgeSourcesLabel','https://defi.swft.pro/',true));
    card.append(sources,label('p','bridgeChecked','ctstyle-discovery-small'));
    controls = {card:card,load:load,allow:permit,close:close,settings:settings,notice:notice,area:area};
    permit.addEventListener('click',function(){
      if(!allowed())return;exchangeRequested=true;
      // Complianz's native delegated handler owns the service-consent decision.
      window.setTimeout(syncConsent,0);
    });
    load.addEventListener('click',function () {exchangeRequested=true;syncConsent();});
    close.addEventListener('click',function () { unload(); load.focus(); });
    return card;
  }
  function mountExchange() {
    if (!allowed() || !consentOK() || frame || !controls || !controls.card.isConnected || controls.card.closest(forbidden)) return;
    exchangeRequested=false;
    frame = element('iframe'); frame.title = 'AllChainBridge / SWFT — external exchange';
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    frame.setAttribute('referrerpolicy','no-referrer'); frame.setAttribute('loading','lazy');
    frame.setAttribute('width','100%'); frame.setAttribute('height','740');
    frame.setAttribute('data-category','marketing');frame.setAttribute('data-service','swft');
    // Full original destination; no pair restriction, account handoff or signing bridge.
    // Complianz activates service-tagged frames from data-src-cmplz during its
    // consent event. Preserve the same full URL for that native activation.
    frame.setAttribute('data-src-cmplz',exchangeURL);
    frame.src = exchangeURL; controls.area.append(frame); controls.load.hidden=true;controls.close.hidden=false;
  }
  function mobileBuyingRoutes(layout, panels, nav) {
    // Keep the original controls in the same panel. Collapsing only changes
    // presentation, so an opened exchange retains its frame and consent owner.
    panels.forEach(function (item) {
      var panel=item[0], key=item[1], body=element('div','ctstyle-crypto-panel-body');
      body.id=panel.id+'-body';
      var toggle=element('button','ctstyle-crypto-route-toggle');toggle.type='button';
      toggle.setAttribute('aria-controls',body.id);toggle.setAttribute('aria-expanded','false');
      var text=element('span','ctstyle-crypto-route-copy');
      text.append(label('strong',key),label('span',key+'Text','ctstyle-crypto-route-description'));
      toggle.append(text);
      var host=panel;
      // The guide's translator deliberately rejects embedded controls. Keep
      // its disclosure outside the owned article, without relaxing that guard.
      if(panel.classList.contains('cal-buy-guide')){
        host=element('div','ctstyle-crypto-guide-route');panel.before(host);body.append(panel);
      }else{while(panel.firstChild)body.append(panel.firstChild);}
      host.append(toggle,body);host.classList.add('ctstyle-crypto-route-panel');
      toggle.addEventListener('click',function(){toggle.setAttribute('aria-expanded',toggle.getAttribute('aria-expanded')==='true'?'false':'true');});
    });
    layout.classList.add('ctstyle-mobile-routes');
    function reveal(hash) {
      var id;try{id=decodeURIComponent((hash||'').replace(/^#/,''));}catch(_){return;}
      var target=id&&document.getElementById(id);
      var panel=target&&target.closest('.ctstyle-crypto-route-panel');
      if(panel&&layout.contains(panel))panel.querySelector('.ctstyle-crypto-route-toggle').setAttribute('aria-expanded','true');
    }
    nav.querySelectorAll('a[href]').forEach(function(a){a.addEventListener('click',function(){reveal(a.getAttribute('href'));});});
    window.addEventListener('hashchange',function(){reveal(window.location.hash);});
    reveal(window.location.hash);
  }
  function buyingPage() {
    if (Number(cfg.page) !== 4205 || !['/index.php/how-to-buy-calorie/','/how-to-buy-calorie/'].includes(window.location.pathname) || hub) return;
    var guide = unique('.cal-buy-guide[data-calorieapp-buy-guide="1"]');
    if (!safe(guide) || document.getElementById('ctstyle-cal-crypto')) return;
    // Keep the existing translated guide and every original provider destination in place.
    hub = element('div','ctstyle-discovery'); hub.id = 'ctstyle-cal-crypto';
    var intro=element('header','ctstyle-crypto-intro');
    intro.append(element('p','ctstyle-crypto-kicker','CalorieToken · XRP Ledger'),label('h2','exchangeLabel'),label('p','intro','ctstyle-discovery-intro'));
    var actions=element('div','ctstyle-discovery-actions');
    actions.append(link('exploreApp',window.location.origin+'/index.php/calorieapp/',false),link('readWhitepaper',window.location.origin+'/index.php/whitepaper/',false));
    intro.append(label('p','appPitch','ctstyle-crypto-app-pitch'),actions,label('p','appWithoutCAL','ctstyle-discovery-small'));
    var journey=element('ol','ctstyle-crypto-journey');
    ['Wallet','Route','Review'].forEach(function(key){var step=element('li');step.append(label('h3','journey'+key),label('p','journey'+key+'Text'));journey.append(step);});
    intro.append(journey);hub.append(intro);
    var nav = element('nav','ctstyle-discovery-tabs'); nav.setAttribute('aria-label','CAL & Crypto');
    if (!guide.id) guide.id = 'ctstyle-cal-options';
    [['routeTrade','#ctstyle-own-dex'],['routeLearn','#'+guide.id],['routeOther','#ctstyle-external-exchange']].forEach(function (route) {
      var action=element('a','ctstyle-discovery-action'); action.href=route[1];
      var copy=element('span','ctstyle-crypto-route-copy');
      copy.append(label('strong',route[0]),label('span',route[0]+'Text','ctstyle-crypto-route-description'));
      action.append(copy); nav.append(action);
    });
    hub.append(nav);
    var dex = section('ctstyle-own-dex','dexTitle');
    dex.append(label('p','dexStatus','ctstyle-discovery-badge'),label('p','dexText'),link('openDex',dexURL,true),link('openSwap','https://xpmarket.com/swap/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP/market',true),trustlineCard('ctstyle-buy-trustline'));
    hub.append(dex,label('h2','guideTitle','ctstyle-guide-heading'));
    var layout=element('div','ctstyle-exchange-layout');guide.before(layout);
    var exchange=exchangeCard();
    layout.append(hub,guide,exchange);guide.classList.add('ctstyle-second-route');
    mobileBuyingRoutes(layout,[[dex,'routeTrade'],[guide,'routeLearn'],[exchange,'routeOther']],nav);
    var heading = unique('.ctstyle-title h1');
    if (safe(heading) && /^how\s*to\s*buy(?:\s*(calorie|cal))?$/i.test(heading.textContent.trim())) {
      // Only a recognized old title. Preserve heading element, banner and inherited font.
      heading.textContent = 'CAL & Crypto'; heading.classList.add('ctstyle-cal-crypto-title');
    }
    if (/^how\s+to\s+buy(?:\s+(?:calorie|cal))?(?=\s*[|–—-]|$)/i.test(document.title)) {
      document.title = document.title.replace(/^how\s+to\s+buy(?:\s+(?:calorie|cal))?/i,'CAL & Crypto');
    }
    syncConsent();
  }
  function trustPage() {
    if (Number(cfg.page) !== 1205 || !['/index.php/trustline/','/trustline/'].includes(window.location.pathname) || trust) return;
    var details = unique('[data-brz-custom-id="nrsbytvlhdquaddotxqmaeiihmzfbcufpmhr"]');
    if (!safe(details) || document.getElementById('ctstyle-direct-trustline')) return;
    trust = trustlineCard('ctstyle-direct-trustline');
    var xaman = unique('[data-brz-custom-id="inpxenkjojstawbfbmiwkgigeabgzzcmectb"]');
    var toolkit = unique('[data-brz-custom-id="tudwxqvkogbjptwlykgwzlzdixbhxidyqhku"]');
    if (safe(xaman) && safe(toolkit) && xaman.parentElement === toolkit.parentElement &&
        xaman.querySelectorAll('.brz-column__items').length === 1 && toolkit.contains(details)) {
      // The live Brizy page has two separate, single-column row containers.
      // Move the original nodes together; preserve their controls and listeners.
      var options = element('div','ctstyle-trustline-options');
      xaman.before(options); options.append(xaman,toolkit);
      xaman.classList.add('ctstyle-trustline-option'); toolkit.classList.add('ctstyle-trustline-option');
      xaman.querySelector('.brz-column__items').append(trust);
    } else {
      var row = details.closest('.brz-row__container');
      (safe(row) ? row : details).before(trust);
    }
  }
  function appPage() {
    if (Number(cfg.page) !== 7880 || test || document.getElementById('ctstyle-testnet')) return;
    var reference = unique('[data-ctstyle-app-info]') || unique('.calorieapp-app-info[data-calorieapp-app-info]');
    if (!safe(reference)) return;
    test = section('ctstyle-testnet','testTitle');
    test.setAttribute('data-ctstyle-testnet','1');
    var disclosure = element('details','ctstyle-testnet-disclosure');
    var toggle = element('summary'); toggle.append(test.firstElementChild);
    disclosure.append(toggle,label('p','testIntro'),label('p','testLimit','ctstyle-discovery-status'));
    var details = element('details','ctstyle-test-steps'), summary = label('summary','testOpen'); details.append(summary);
    var list = element('ol');
    ['testNetwork','testReturn'].forEach(function (key) { list.append(label('li',key)); });
    details.append(list,link('officialHelp',helpURL,true),link('installXaman','https://xaman.app/',true));
    disclosure.append(details); test.append(disclosure); reference.before(test);
    // Keep the installed live market widget and its listeners; only change its
    // position within the same shared ending on the CalorieApp page.
    var ending = test.closest('.calorieapp-shared-page-ending');
    var markets = ending && ending.querySelectorAll('.calorieapp-page-market');
    if (markets && markets.length === 1 && markets[0].parentElement === ending &&
        markets[0].querySelector('[data-calorieapp-xpmarket-widget="1"]') &&
        !markets[0].querySelector('form,iframe,[contenteditable],[data-calorieapp-embed]')) test.after(markets[0]);
    function revealLinkedGuide() {
      if (!allowed() || window.location.hash !== '#ctstyle-testnet') return;
      disclosure.open = true;
      if (typeof test.scrollIntoView === 'function') test.scrollIntoView({block:'start'});
    }
    revealLinkedGuide();
    window.addEventListener('hashchange',revealLinkedGuide);
  }
  function cookieVisible() {
    function visible(node) {
      if (node.hidden || node.classList.contains('cmplz-dismissed')) return false;
      var style = window.getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity) !== 0;
    }
    return Array.from(document.querySelectorAll('.cmplz-cookiebanner')).some(function (node) {
      var container = node.closest('#cmplz-cookiebanner-container');
      return visible(node) && (!container || visible(container));
    });
  }
  function syncCookieVisibility() {
    if (!allowed()) return;
    var visible = cookieVisible();
    if (document.body.classList.contains('ctstyle-cookie-banner-open') !== visible) {
      document.body.classList.toggle('ctstyle-cookie-banner-open', visible);
    }
    if (launcher && launcher.hidden !== visible) launcher.hidden = visible;
  }
  function watchCookieBanner() {
    if (cookieWatcher || typeof MutationObserver !== 'function') return;
    var selector = '#cmplz-cookiebanner-container,.cmplz-cookiebanner';
    cookieAttributeWatcher = new MutationObserver(syncCookieVisibility);
    function trackBanners() {
      cookieAttributeWatcher.disconnect();
      document.querySelectorAll(selector).forEach(function (node) {
        cookieAttributeWatcher.observe(node,{attributes:true,attributeFilter:['class','style','hidden']});
      });
      syncCookieVisibility();
    }
    cookieWatcher = new MutationObserver(function (records) {
      if (records.some(function (record) {
        return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(function (node) {
          return node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector));
        });
      })) trackBanners();
    });
    // Observe only structure here; Brizy class/style changes are unrelated.
    cookieWatcher.observe(document.body,{childList:true,subtree:true});
    trackBanners();
  }
  function websiteLanguage(tag, remember) {
    if (!allowed() || !cfg.copy[tag]) return;
    if (remember) {
      try { window.localStorage.setItem(preferenceKey,JSON.stringify({locale:tag,savedAt:Date.now()})); } catch (_) {}
    }
    refresh(tag);
    if (window.CalorieTokenAppInfo) window.CalorieTokenAppInfo.refresh(tag);
    ['CalorieTokenPageLanguage','CalorieAppBuyGuide','CalorieAppTrustline','CalorieAppRichlist','CalorieAppBlogX','CalorieAppPageNavigation'].forEach(function (key) {
      if (window[key] && typeof window[key].setLocale === 'function') window[key].setLocale(tag);
    });
    document.dispatchEvent(new window.CustomEvent('calorietoken:display-language',{detail:{locale:tag,explicit:remember === true}}));
  }
  function languagePicker(id, host) {
    var language = label('label','languageLabel','ctstyle-widget-language'); language.htmlFor = id;
    var select = element('select','ctstyle-language-picker'); select.id = id;
    var names = {en:'English',nl:'Nederlands','zh-Hans':'简体中文',hi:'हिन्दी',es:'Español',ar:'العربية',fr:'Français',bn:'বাংলা',pt:'Português',id:'Bahasa Indonesia',ur:'اردو'};
    Object.keys(cfg.copy).forEach(function (tag) { var option = element('option','',names[tag]); option.value = tag; option.lang = tag; select.append(option); });
    select.value = lang(); pickers.push(select); host.append(language,select);
    select.addEventListener('change',function () {
      var tag = select.value; if (!cfg.copy[tag]) return;
      websiteLanguage(tag,true);
      var native = unique('[data-calorieapp-display-language][data-ready="1"] select');
      if (native && !native.closest('[hidden],[inert]') && Array.from(native.querySelectorAll('option')).some(function (option) { return option.value === tag; })) {
        native.value = tag; native.dispatchEvent(new window.Event('change',{bubbles:true}));
      }
    });
    return select;
  }
  function accountWidget() {
    if (!allowed()) return;
    var cards = Array.from(document.querySelectorAll('.xl-card')).filter(function (card) {
      if (card.closest('template,form,[contenteditable],[hidden],[inert],[aria-hidden="true"],[data-calorieapp-embed]')) return false;
      for (var node=card;node && node!==document.body;node=node.parentElement) {
        var style=window.getComputedStyle(node);
        if (style.display==='none' || style.visibility==='hidden') return false;
      }
      return true;
    });
    if (!accountApp) {
      if (document.getElementById('ctstyle-account-app')) return;
      accountApp = element('div','ctstyle-account-app'); accountApp.id = 'ctstyle-account-app';
      var action = link('openApp',cfg.appURL), logo = element('img');
      logo.src=cfg.appLogo;logo.alt='';logo.width=26;logo.height=26;
      var heading=element('div','ctstyle-account-app-brand');heading.append(logo,element('strong','','CalorieApp'));
      accountApp.append(heading,action); languagePicker('ctstyle-account-language',accountApp);
    }
    if (cards.length === 1) {
      var card = cards[0];
      if (!card.contains(accountApp)) {
        var footers=card.querySelectorAll('.xl-card-footer');
        (footers.length===1 ? footers[0] : card).append(accountApp);
      }
      accountApp.classList.remove('ctstyle-account-app-standalone');
    } else if (!accountApp.isConnected) {
      var header=document.querySelector('.ctstyle-header,header.site-header,#masthead') || document.querySelector('.brz-section,main');
      if (header) {accountApp.classList.add('ctstyle-account-app-standalone');header.after(accountApp);}
    }
    direction(accountApp,lang());
  }
  function watchAccount() {
    if (accountWatcher || typeof MutationObserver !== 'function') return;
    accountWatcher = new MutationObserver(function (records) {
      if (records.some(function (record) {
        // Native login widgets can replace just their footer/contents. Reattach
        // our existing controls when removed, without rebuilding the login card.
        if (accountApp && !accountApp.isConnected && Array.from(record.removedNodes).some(function (node) {
          return node===accountApp || node.nodeType===1 && node.contains(accountApp);
        })) return true;
        return Array.from(record.addedNodes).some(function (node) {
          return node.nodeType===1 && !node.closest('#ctstyle-account-app') &&
            (node.matches('.xl-card,.ctstyle-header') || node.querySelector('.xl-card'));
        });
      })) {accountWidget();}
    });
    accountWatcher.observe(document.body,{childList:true,subtree:true});
  }
  function widget() {
    if (launcher || document.getElementById('ctstyle-app-launcher') || document.querySelector('[contenteditable="true"],.brz-ed')) return;
    if (new URL(cfg.appURL).origin !== window.location.origin) return;
    launcher = element('aside','ctstyle-app-launcher'); launcher.id = 'ctstyle-app-launcher';
    var details = element('details'), summary = element('summary'), icon = element('span','ctstyle-help-icon','?');
    icon.setAttribute('aria-hidden','true');
    summary.append(icon,element('span','ctstyle-help-caption','CalorieHelp')); details.append(summary);
    var panel = element('div','ctstyle-app-launcher-panel');
    panel.append(label('p','appPitch'));
    if (Number(cfg.page) !== 7880) panel.append(link('openApp',cfg.appURL),link('testTitle',cfg.appURL+'#ctstyle-testnet'));
    picker = languagePicker('ctstyle-language-select',panel);
    details.append(panel); launcher.append(details); document.body.append(launcher);
    syncCookieVisibility();
    details.addEventListener('keydown',function (event) { if (event.key === 'Escape' && details.open) { details.open = false; summary.focus(); } });
  }
  function navigation() {
    // Change only the known label at the existing destination. No menu, URL or metadata rewrite.
    document.querySelectorAll('nav a[href],.brz-menu a[href],.brz-menu-simple a[href]').forEach(function (a) {
      if (a.closest(forbidden)) return;
      var url; try { url = new URL(a.getAttribute('href'),window.location.href); } catch (_) { return; }
      if (url.origin !== window.location.origin || url.search || url.hash ||
          !['/index.php/how-to-buy-calorie/','/how-to-buy-calorie/'].includes(url.pathname)) return;
      var texts = [];
      function collect(node) { Array.from(node.childNodes).forEach(function (child) { if (child.nodeType === 3 && child.data.trim()) texts.push(child); else if (child.nodeType === 1 && !child.matches('svg,img,script,style')) collect(child); }); }
      collect(a);
      if (texts.length === 1 && /^how\s*to\s*buy(?:\s*(calorie|cal))?$/i.test(texts[0].data.trim())) texts[0].data = 'CAL & Crypto';
    });
  }
  function sharedLanguage(tag) {
    var all=window.CalorieTokenSiteStyleMenu && window.CalorieTokenSiteStyleMenu.sharedLabels;
    if (!all || !all[tag]) return;
    document.querySelectorAll('.brz-menu-simple a[href],.ctstyle-header-nav a[href],.showcase-header-menu a[href],.showcase-mobile-menu a[href],.ctstyle-footer .ctstyle-legal-links a[href]').forEach(function (a) {
      if (a.closest('form,[contenteditable],.xl-card,[hidden],[inert]')) return;
      var url;try {url=new URL(a.getAttribute('href'),window.location.href);} catch (_) {return;}
      var route=url.pathname.replace(/^\/index\.php(?=\/|$)/,'').replace(/\/+$/,'') || '/';
      if (url.origin!==window.location.origin || url.search || url.hash || !all[tag][route]) return;
      var texts=[];
      function visit(node) {Array.from(node.childNodes).forEach(function (child) {if(child.nodeType===3 && child.data.trim()) texts.push(child);else if(child.nodeType===1 && !child.matches('svg,img,script,style')) visit(child);});}
      visit(a);if (texts.length!==1) return;
      var entry=menuLabels.get(a), text=texts[0];
      if (!entry) {
        var known=Object.values(all).some(function (copy) {return copy[route]===text.data.trim();});
        if (!known) return;
        entry={node:text,last:text.data};menuLabels.set(a,entry);
      }
      if (entry.node!==text || entry.last!==text.data) return;
      text.data=all[tag][route];entry.last=text.data;a.lang=tag;a.dir=['ar','ur'].includes(tag)?'rtl':'ltr';
    });
  }
  function refresh(locale) {
    if (!allowed()) return;
    if (!preferenceRead) {
      preferenceRead = true;
      try {
        var saved = JSON.parse(window.localStorage.getItem(preferenceKey));
        if (saved && Object.keys(saved).length === 2 && cfg.copy[saved.locale] && typeof saved.savedAt === 'number' &&
            Date.now() >= saved.savedAt && Date.now() - saved.savedAt < 30*86400000) requestedLocale = saved.locale;
      } catch (_) {}
      var explicit = new URL(window.location.href).searchParams.get('ui_lang');
      if (cfg.copy[explicit]) requestedLocale = explicit;
    }
    if (locale) requestedLocale = locale;
    buyingPage(); trustPage(); appPage(); widget(); accountWidget(); watchAccount(); navigation();
    syncCookieVisibility(); watchCookieBanner();
    var tag = lang();
    sharedLanguage(tag);
    nodes.forEach(function (entry) {
      // Do not overwrite an intervening custom edit or provider-generated content.
      if (entry.node.childNodes.length === 1 && entry.node.firstChild.nodeType === 3 &&
          Object.values(cfg.copy).some(function (copy) { return copy[entry.key] === entry.node.textContent; })) entry.node.textContent = cfg.copy[tag][entry.key];
    });
    [hub,controls && controls.card,trust,test,launcher].filter(Boolean).forEach(function (node) { direction(node,tag); });
    pickers.forEach(function (select) {select.value=tag;});
    if (accountApp) direction(accountApp,tag);
    if (window.CalorieTokenTestnet) window.CalorieTokenTestnet.refresh(tag);
  }
  window.CalorieTokenDiscoveryUI = {refresh:refresh,getLocale:lang,setLocale:websiteLanguage};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',function () { refresh(); },{once:true}); else refresh();
  window.addEventListener('load',function () { websiteLanguage(lang(),false); syncConsent(); syncCookieVisibility(); },{once:true});
  window.addEventListener('pagehide',unload);
  window.addEventListener('pagehide',function () {if (accountWatcher) {accountWatcher.disconnect();accountWatcher=null;}});
  window.addEventListener('pagehide',function () {
    if (cookieWatcher) {cookieWatcher.disconnect();cookieWatcher=null;}
    if (cookieAttributeWatcher) {cookieAttributeWatcher.disconnect();cookieAttributeWatcher=null;}
  });
  window.addEventListener('pageshow',function () {if (allowed()) {accountWidget();watchAccount();syncCookieVisibility();watchCookieBanner();}});
  document.addEventListener('cmplz_cookie_warning_loaded',syncCookieVisibility);
  ['cmplz_status_change','cmplz_status_change_service','cmplz_service_status_change','cmplz_revoke','cmplz_enable_category','cmplz_enable_service'].forEach(function (name) {
    document.addEventListener(name,function () {
      revoked = name === 'cmplz_revoke';
      if(revoked)unload();
      syncConsent(); syncCookieVisibility();
    });
  });
  document.addEventListener('change',function (event) {
    if (event.target.matches('select') && event.target.closest('[data-calorieapp-display-language]')) websiteLanguage(event.target.value,true);
  });
})();
