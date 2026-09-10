/* Public display language, explicit guide navigation and scoped camera delegation. */
(function () {
  'use strict';
  var cfg = window.CalorieTokenDiscovery, runtime = window.CalorieAppDisplayLanguage;
  if (!cfg || !runtime || Number(cfg.page) !== 7880 || window.CalorieTokenAppIntegration) return;
  var appOrigins = ['https://app.calorietoken.net', 'https://calorieapp-frontend.onrender.com'];
  var active = true, started = false;
  var prefix = 'calorieapp:testnet-guide:';
  function allowed() {
    return active && document.body && document.body.matches('.ctstyle-enabled.page-id-7880') &&
      !document.querySelector('.brz-ed,#brz-ed-iframe,[contenteditable="true"]') &&
      ['https://calorietoken.net','https://www.calorietoken.net'].includes(window.location.origin) &&
      ['/index.php/calorieapp/','/calorieapp/'].includes(window.location.pathname) &&
      Array.from(new URL(window.location.href).searchParams.keys()).every(function (key) { return key === 'ui_lang'; });
  }
  function frames() {
    if (!allowed()) return [];
    var all = document.querySelectorAll('[data-calorieapp-embed] iframe');
    if (all.length !== 1 || all[0].closest('form,[contenteditable],[hidden],[inert]')) return [];
    try {
      var url = new URL(all[0].src);
      if (!appOrigins.includes(url.origin) || url.pathname !== '/' || url.username || url.password || !all[0].contentWindow) return [];
    } catch (_) { return []; }
    return [{window:all[0].contentWindow,origin:url.origin,node:all[0]}];
  }
  function cameraPermission() {
    // Only the one verified app may ask the visitor to use its camera. Keep all
    // existing directives, including an explicit operator camera restriction.
    frames().forEach(function (frame) {
      var permission=frame.node.getAttribute('allow')||'';
      if (!permission.split(';').some(function (part) {return /^camera(?:\s|$)/i.test(part.trim());})) {
        frame.node.setAttribute('allow',permission+(permission.trim()?'; ':'')+'camera '+frame.origin);
      }
    });
  }
  function trusted(event) {
    return frames().some(function (frame) { return frame.window === event.source && frame.origin === event.origin; });
  }
  function announce() {
    if (!document.querySelector('#ctstyle-testnet[data-ctstyle-testnet="1"]')) return;
    frames().forEach(function (frame) { frame.window.postMessage({type:prefix+'available',version:1},frame.origin); });
  }
  function openGuide() {
    var guide = document.querySelector('#ctstyle-testnet[data-ctstyle-testnet="1"]');
    if (!guide) return;
    if (typeof guide.scrollIntoView === 'function') guide.scrollIntoView({block:'start',behavior:'auto'});
    var heading = guide.querySelector('h2');
    if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
  }
  function init() {
    if (!allowed()) return;
    cameraPermission();
    if (started || !window.CalorieTokenDiscoveryUI) return;
    started = true;
    // A native display controller, when already active, remains the sole host.
    if (!document.querySelector('[data-calorieapp-display-language][data-ready="1"]') &&
        window.crypto && typeof window.crypto.randomUUID === 'function') {
      var ui = window.CalorieTokenDiscoveryUI;
      var store = runtime.createStore({locales:Object.keys(cfg.copy),fallback:'en',initialLocale:ui.getLocale(),storage:{
        getItem:function (key) { return window.localStorage.getItem(key); },
        setItem:function (key,value) { window.localStorage.setItem(key,value); },
        removeItem:function (key) { window.localStorage.removeItem(key); }
      }});
      var explicit = new URL(window.location.href).searchParams.get('ui_lang');
      if (store.valid(explicit)) store.apply(explicit,true);
      ui.setLocale(store.get().locale,false);
      store.subscribe(function (state) { ui.setLocale(state.locale,false); });
      document.addEventListener('calorietoken:display-language',function (event) {
        if (allowed() && event.detail && event.detail.explicit === true) store.select(event.detail.locale);
      });
      runtime.connectHost({window:window,frames:frames,epoch:window.crypto.randomUUID(),store:store});
    }
    window.addEventListener('message',function (event) {
      var data = event.data;
      if (!trusted(event) || !data || typeof data !== 'object' || Array.isArray(data) ||
          Object.keys(data).length !== 2 || data.version !== 1) return;
      if (data.type === prefix+'ready') announce();
      else if (data.type === prefix+'open') openGuide();
    });
    announce();
  }
  window.CalorieTokenAppIntegration = {refresh:init};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  window.addEventListener('load',function () { init(); announce(); });
  window.addEventListener('pagehide',function () { active = false; });
  window.addEventListener('pageshow',function () { active = true; init(); announce(); });
})();
